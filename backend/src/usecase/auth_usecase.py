from sqlmodel import Session

from common.exceptions import ConflictError, ValidationError
from common.rate_limit import verification_rate_limiter
from interfaces.auth import AuthService, AuthTokens, AuthUser
from models.user import User, UserRole
from repo.profile_repo import ProfileRepo
from repo.user_repo import UserRepository
from schemas.auth_model import (
    ConfirmUserRequest,
    ForgotPasswordConfirm,
    UserCreate,
    UserLogin,
)
from usecase.profile_usecase import CURRENT_CONSENT_VERSION

ROLE_PRIORITY = (UserRole.ADMIN, UserRole.PSYCHOLOGIST)


def role_from_groups(groups: list[str]) -> str:
    for role in ROLE_PRIORITY:
        if role.value in groups:
            return role.value
    return UserRole.CLIENT.value


class AuthUsecase:

    def __init__(self, service: AuthService, db: Session):
        self.auth = service
        self.db = db
        self.user_repo = UserRepository(db)
        self.profile_repo = ProfileRepo(db)

    def get_user(self, access_token: str) -> AuthUser:
        return self.auth.get_user(access_token)

    def login_user(self, credentials: UserLogin) -> AuthTokens:
        tokens = self.auth.login_user(credentials)
        id_token = tokens.id_token if hasattr(tokens, "id_token") else (tokens.get("IdToken") if isinstance(tokens, dict) else None)
        self._ensure_local_user(id_token)
        return tokens

    def refresh_access_token(self, refresh_token: str) -> AuthTokens:
        return self.auth.refresh_access_token(refresh_token)

    def create_user(self, credentials: UserCreate):
        """Create a Cognito account, its local rows, and its primary 'self' profile.

        Self-service signup is always a client. Psychologist and admin roles
        can only be assigned by an existing admin after registration.
        """
        if credentials.consent.consent_version != CURRENT_CONSENT_VERSION:
            raise ConflictError(
                f"Consent form is outdated — current version is {CURRENT_CONSENT_VERSION}"
            )

        signup_result = self.auth.create_user(credentials)
        self.auth.add_user_to_group(
            credentials.username, UserRole.CLIENT.value
        )

        # create local rows right away if provider yields the user identity subject
        sub = None
        if hasattr(signup_result, "user_sub"):
            sub = signup_result.user_sub
        elif isinstance(signup_result, dict):
            sub = signup_result.get("UserSub") or signup_result.get("sub")

        if sub:
            user = self.user_repo.get_by_sub(sub)
            if user is None:
                user = self.user_repo.create(
                    User(
                        cognito_sub=sub,
                        email=credentials.email,
                        role=UserRole.CLIENT.value,
                    )
                )
            self._ensure_role_profile(
                user, display_name=credentials.profile.profile_name
            )
            if self.profile_repo.get_self_profile(user.user_id) is None:
                self.profile_repo.create_with_consent(
                    user.user_id, credentials.profile, credentials.consent
                )

        return {"message": "register successful, check email for code"}

    def confirm_user(self, request: ConfirmUserRequest, client_ip: str | None = None):
        username_key = f"confirm:user:{request.username.strip().lower()}"
        checks: list[tuple[str, int, int, str]] = [
            (
                username_key,
                5,
                900,
                "Too many verification attempts. Please wait 15 minutes before trying again.",
            ),
        ]
        if client_ip:
            checks.append(
                (
                    f"confirm:ip:{client_ip}",
                    10,
                    900,
                    "Too many verification attempts from this network. Please try again later.",
                )
            )
        verification_rate_limiter.check_and_record(checks=checks)

        self.auth.confirm_user(request)
        verification_rate_limiter.reset(username_key)
        self._sync_user(request.username)
        return {"message": "user confirmed"}

    def resend_confirmation_code(self, username: str, client_ip: str | None = None):
        norm_username = username.strip().lower()
        checks: list[tuple[str, int, int, str]] = [
            (
                f"resend:user:{norm_username}",
                5,
                900,
                "Too many verification code requests. Please wait before requesting another code.",
            ),
        ]
        if client_ip:
            checks.append(
                (
                    f"resend:ip:{client_ip}",
                    10,
                    900,
                    "Too many verification code requests from this network. Please try again later.",
                )
            )
        verification_rate_limiter.check_and_record(
            checks=checks,
            cooldown_checks=[
                (
                    f"resend:user:{norm_username}",
                    60,
                    "Please wait 60 seconds before requesting another verification code.",
                )
            ],
        )

        self.auth.resend_confirmation_code(username)
        return {"message": "confirmation code sent"}

    def delete_user(self, access_token: str):
        self.auth.delete_user(access_token)
        return {"message": "delete user successful"}

    def logout_user(self, access_token: str):
        self.auth.logout_user(access_token)
        return {"message": "logout successful"}

    def request_forgot_password(self, username: str, client_ip: str | None = None):
        norm_username = username.strip().lower()
        checks: list[tuple[str, int, int, str]] = [
            (
                f"forgot:user:{norm_username}",
                5,
                900,
                "Too many password reset requests. Please wait before requesting another code.",
            ),
        ]
        if client_ip:
            checks.append(
                (
                    f"forgot:ip:{client_ip}",
                    10,
                    900,
                    "Too many password reset requests from this network. Please try again later.",
                )
            )
        verification_rate_limiter.check_and_record(
            checks=checks,
            cooldown_checks=[
                (
                    f"forgot:user:{norm_username}",
                    60,
                    "Please wait 60 seconds before requesting another reset code.",
                )
            ],
        )

        self.auth.request_forgot_password(username)
        return {"message": "confirmation code sent to email"}

    def confirm_forgot_password(
        self, request: ForgotPasswordConfirm, client_ip: str | None = None
    ):
        username_key = f"forgot_confirm:user:{request.username.strip().lower()}"
        checks: list[tuple[str, int, int, str]] = [
            (
                username_key,
                5,
                900,
                "Too many password reset attempts. Please wait 15 minutes before trying again.",
            ),
        ]
        if client_ip:
            checks.append(
                (
                    f"forgot_confirm:ip:{client_ip}",
                    10,
                    900,
                    "Too many password reset attempts from this network. Please try again later.",
                )
            )
        verification_rate_limiter.check_and_record(checks=checks)

        self.auth.confirm_forgot_password(request)
        verification_rate_limiter.reset(username_key)
        return {"message": "password change successful"}

    def _sync_user(self, username: str):
        """Create the local User + role profile rows from auth provider state. Idempotent."""
        profile = self.auth.describe_user(username)
        groups = self.auth.list_user_groups(username)
        role = role_from_groups(groups)

        sub = profile.sub if hasattr(profile, "sub") else profile.get("sub")
        email = profile.email if hasattr(profile, "email") else profile.get("email")

        user = self.user_repo.get_by_sub(sub)
        if user is None:
            user = self.user_repo.create(
                User(
                    cognito_sub=sub,
                    email=email,
                    role=role,
                )
            )
        elif user.role != role:
            user.role = role
            self.user_repo.update(user)

        self._ensure_role_profile(user, display_name=username)

    def _ensure_role_profile(self, user: User, display_name: str):
        """Create the role's profile row when missing.

        The profile rows are FK targets (profiles -> client_profiles), so every
        user needs one. Idempotent.
        """
        self.user_repo.ensure_role_profile(user, display_name)

    def _ensure_local_user(self, id_token: str | None):
        """Heal rows for users created before local sync existed.

        Never breaks login — sync is best-effort.
        """
        if not id_token:
            return

        try:
            claims = self.auth.verify_token(id_token)
        except Exception:
            return

        sub = claims.get("sub")
        if not sub:
            return

        try:
            username = (
                claims.get("cognito:username")
                or claims.get("preferred_username")
                or claims.get("username", "")
            )
            claim_groups = list(
                claims.get("cognito:groups", []) or claims.get("groups", [])
            )
            groups = claim_groups
            if username:
                try:
                    groups = self.auth.list_user_groups(username)
                except Exception:
                    groups = claim_groups

            user = self.user_repo.get_by_sub(sub)

            if user is None:
                user = self.user_repo.create(
                    User(
                        cognito_sub=sub,
                        email=claims.get("email", ""),
                        role=role_from_groups(groups),
                    )
                )
            elif groups:
                # Groups are the source of truth; heal a stale local role
                # after an admin promotion or out-of-band group edit.
                role = role_from_groups(groups)
                if user.role != role:
                    user.role = role
                    self.user_repo.update(user)

            self._ensure_role_profile(user, display_name=username or user.email)
        except Exception:
            return

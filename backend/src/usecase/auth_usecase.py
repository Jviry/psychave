from datetime import datetime, timezone
from sqlmodel import Session

from common.exceptions import BadRequestError, ConflictError, NotFoundError, ValidationError
from common.rate_limit import verification_rate_limiter
from interfaces.auth import AuthService, AuthTokens, AuthUser
from models.psychologist_invitation import PsychologistInvitation
from models.psychologist_profile import PsychologistProfile
from models.user import User, UserRole
from repo.consent_template_repo import ConsentTemplateRepo
from repo.profile_repo import ProfileRepo
from repo.psychologist_invitation_repo import PsychologistInvitationRepo
from repo.user_repo import UserRepository
from schemas.auth_model import (
    CheckAvailabilityResponse,
    ConfirmUserRequest,
    ForgotPasswordConfirm,
    PsychologistInvitationVerifyRead,
    PsychologistInviteRegisterRequest,
    UserCreate,
    UserLogin,
)
from usecase.consent_template_usecase import ConsentTemplateUsecase

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
        self.invitation_repo = PsychologistInvitationRepo(db)

    def get_user(self, access_token: str) -> AuthUser:
        return self.auth.get_user(access_token)

    def login_user(self, credentials: UserLogin) -> AuthTokens:
        tokens = self.auth.login_user(credentials)
        id_token = tokens.id_token if hasattr(tokens, "id_token") else (tokens.get("IdToken") if isinstance(tokens, dict) else None)
        self._ensure_local_user(id_token)
        return tokens

    def refresh_access_token(self, refresh_token: str) -> AuthTokens:
        return self.auth.refresh_access_token(refresh_token)

    def check_availability(
        self,
        email: str | None = None,
        username: str | None = None,
        client_ip: str | None = None,
    ) -> CheckAvailabilityResponse:
        if client_ip:
            verification_rate_limiter.check_and_record(
                checks=[
                    (
                        f"availability:ip:{client_ip}",
                        30,
                        900,
                        "Too many availability checks. Please wait a moment and try again.",
                    )
                ]
            )

        email_available = True
        if email and email.strip():
            norm_email = email.strip().lower()
            if (
                self.user_repo.get_by_email(norm_email) is not None
                or self.auth.get_username_by_email(norm_email) is not None
            ):
                email_available = False

        username_available = True
        if username and username.strip():
            try:
                self.auth.describe_user(username.strip())
                username_available = False
            except NotFoundError:
                username_available = True

        return CheckAvailabilityResponse(
            email_available=email_available,
            username_available=username_available,
        )

    def create_user(self, credentials: UserCreate):
        """Create a Cognito account, its local rows, and its primary 'self' profile.

        Self-service signup is always a client. Psychologist and admin roles
        can only be assigned by an existing admin after registration.
        """
        norm_email = str(credentials.email).strip().lower()
        if (
            self.user_repo.get_by_email(norm_email) is not None
            or self.auth.get_username_by_email(norm_email) is not None
        ):
            raise ConflictError("An account with this email is already registered")

        active_template = ConsentTemplateRepo(self.db).ensure_default_seeded()
        details, responses, _sections = (
            ConsentTemplateUsecase.validate_wizard_submission(
                wizard_pages=active_template.wizard_pages,
                active_version=active_template.consent_version,
                profile_data=credentials.profile,
                consent_data=credentials.consent,
                validate_demographics=True,
                validate_consent=True,
            )
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
                        email=norm_email,
                        role=UserRole.CLIENT.value,
                    )
                )
            self._ensure_role_profile(
                user, display_name=credentials.profile.profile_name
            )
            if self.profile_repo.get_self_profile(user.user_id) is None:
                self.profile_repo.create_with_consent(
                    client_id=user.user_id,
                    profile_data=credentials.profile,
                    consent_version=active_template.consent_version,
                    details=details,
                    responses=responses,
                )

        return {"message": "register successful, check email for code"}

    def _validate_active_invitation(
        self, raw_token: str
    ) -> PsychologistInvitation:
        invitation = self.invitation_repo.get_by_raw_token(raw_token)
        if invitation is None:
            raise BadRequestError(
                "This psychologist invitation link is invalid or has expired."
            )
        if invitation.used_at is not None:
            raise BadRequestError(
                "This psychologist invitation link has already been used."
            )
        if invitation.revoked_at is not None:
            raise BadRequestError(
                "This psychologist invitation link has been revoked."
            )
        expires_at = invitation.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= datetime.now(timezone.utc):
            raise BadRequestError(
                "This psychologist invitation link has expired."
            )
        return invitation

    def verify_psychologist_invitation(
        self, raw_token: str
    ) -> PsychologistInvitationVerifyRead:
        invitation = self._validate_active_invitation(raw_token)
        return PsychologistInvitationVerifyRead(
            email=invitation.email,
            expires_at=invitation.expires_at,
        )

    def register_invited_psychologist(
        self, payload: PsychologistInviteRegisterRequest
    ) -> dict[str, str]:
        invitation = self._validate_active_invitation(payload.token)
        email = invitation.email.strip().lower()

        if self.user_repo.get_by_email(email) is not None:
            raise ConflictError("An account with this email is already registered")

        signup_result = self.auth.create_confirmed_user(
            username=payload.username,
            email=email,
            password=payload.password,
        )
        self.auth.add_user_to_group(
            payload.username, UserRole.PSYCHOLOGIST.value
        )

        sub = None
        if hasattr(signup_result, "user_sub"):
            sub = signup_result.user_sub
        elif isinstance(signup_result, dict):
            sub = signup_result.get("UserSub") or signup_result.get("sub")
        if not sub:
            described = self.auth.describe_user(payload.username)
            sub = described.sub if hasattr(described, "sub") else described.get("sub")

        user = self.user_repo.get_by_sub(sub) if sub else None
        if user is None:
            user = self.user_repo.create(
                User(
                    cognito_sub=sub or "",
                    email=email,
                    role=UserRole.PSYCHOLOGIST.value,
                )
            )
        elif user.role != UserRole.PSYCHOLOGIST.value:
            user.role = UserRole.PSYCHOLOGIST.value
            user = self.user_repo.update(user)

        existing_profile = self.user_repo.get_psychologist_profile(user.user_id)
        social_links = [link.model_dump() for link in payload.social_media_links]
        if existing_profile is None:
            self.db.add(
                PsychologistProfile(
                    psychologist_id=user.user_id,
                    full_name=payload.full_name,
                    license_number=payload.license_number,
                    specialization=payload.specialization,
                    bio=payload.bio,
                    social_media_links=social_links,
                )
            )
        else:
            existing_profile.full_name = payload.full_name
            existing_profile.license_number = payload.license_number
            existing_profile.specialization = payload.specialization
            existing_profile.bio = payload.bio
            existing_profile.social_media_links = social_links
            self.db.add(existing_profile)

        self.db.commit()
        self.invitation_repo.mark_used(invitation)
        return {
            "message": "Psychologist account created successfully. You can now sign in."
        }

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

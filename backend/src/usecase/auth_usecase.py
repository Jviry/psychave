from common.security.cognito import verify_token
from schemas.auth_model import (
    UserLogin,
    UserCreate,
    ConfirmUserRequest,
    ForgotPasswordConfirm
)
from models.user import User, UserRole
from repo.user_repo import UserRepository
from schemas.auth_model import (
    ConfirmUserRequest,
    ForgotPasswordConfirm,
    UserCreate,
    UserLogin,
)

# Admin wins over psychologist if a user somehow belongs to both groups.
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

    def get_user(self, access_token: str) -> AuthUser:
        return self.auth.get_user(access_token)

    def login_user(self, credentials: UserLogin) -> AuthTokens:
        tokens = self.auth.login_user(credentials)
        self._ensure_local_user(tokens.id_token)
        return tokens

    def refresh_access_token(self, refresh_token: str) -> AuthTokens:
        return self.auth.refresh_access_token(refresh_token)

    def create_user(self, credentials: UserCreate):
        """Create a Cognito account and its local rows.

<<<<<<< HEAD
        signup_result = self.auth.create_user(credentials)
        self.auth.add_user_to_group(
            credentials.username, credentials.role.value
        )

        # create local rows right away if provider yields the user identity subject
        sub = signup_result.user_sub if signup_result else None
        if sub:
            user = self.user_repo.get_by_sub(sub)
            if user is None:
                user = self.user_repo.create(
                    User(
                        cognito_sub=sub,
                        email=credentials.email,
                        role=credentials.role.value,
                    )
                )
            self._ensure_role_profile(
                user, display_name=credentials.full_name or credentials.username
            )
=======
        Self-service signup is always a client. Psychologist and admin roles
        can only be assigned by an existing admin after registration.
        """
        response = self.auth.create_user(credentials)
        self.auth.add_user_to_group(
            credentials.username, UserRole.CLIENT.value)

        # create the local rows right away — sign_up hands us the UserSub,
        # so the profile exists before confirm
        cognito_sub = response.get("UserSub") if response else None
        if cognito_sub:
            user = self.user_repo.get_by_cognito_sub(cognito_sub)
            if user is None:
                user = self.user_repo.create(User(
                    cognito_sub=cognito_sub,
                    email=credentials.email,
                    role=UserRole.CLIENT.value,
                ))
            self._ensure_role_profile(
                user, display_name=credentials.username)


>>>>>> > 5b92107a6d8d46235235e2bf29eed3fd181e3296

        return {"message": "register successful, check email for code"}

    def confirm_user(self, request: ConfirmUserRequest):
        self.auth.confirm_user(request)
        self._sync_user(request.username)

        return {"message": "user confirmed"}

    def resend_confirmation_code(self, username: str):
        self.auth.resend_confirmation_code(username)

        return {"message": "confirmation code sent"}

    def delete_user(self, access_token: str):
        self.auth.delete_user(access_token)

        return {"message": "delete user successful"}

    def logout_user(self, access_token: str):
        self.auth.logout_user(access_token)

        return {"message": "logout successful"}

    def request_forgot_password(self, username: str):
        self.auth.request_forgot_password(username)

        return {"message": "confirmation code sent to email"}

    def confirm_forgot_password(self, request: ForgotPasswordConfirm):
        self.auth.confirm_forgot_password(request)

        return {"message": "password change successful"}

    def _sync_user(self, username: str):
        """Create the local User + role profile rows from auth provider state. Idempotent."""
        profile = self.auth.describe_user(username)
        groups = self.auth.list_user_groups(username)
        role = role_from_groups(groups)

        user = self.user_repo.get_by_sub(profile.sub)
        if user is None:
<<<<<<< HEAD
            user = self.user_repo.create(
                User(
                    cognito_sub=profile.sub,
                    email=profile.email,
                    role=role,
                )
            )
=======
            user = self.user_repo.create(User(
                cognito_sub=profile["sub"],
                email=profile["email"],
                role=role,
            ))
        elif user.role != role:
            user.role = role
            self.user_repo.update(user)

>>>>>>> 5b92107a6d8d46235235e2bf29eed3fd181e3296
        self._ensure_role_profile(user, display_name=username)

    def _ensure_role_profile(self, user: User, display_name: str):
        """Create the role's profile row when missing.

        The profile rows are FK targets (persona -> client_profiles), so every
        user needs one. Idempotent.
        """
<<<<<<< HEAD
        name = display_name or user.email

        if user.role == UserRole.CLIENT.value:
            if self.db.get(ClientProfile, user.user_id) is None:
                self.db.add(ClientProfile(client_id=user.user_id))
        elif user.role == UserRole.PSYCHOLOGIST.value:
            if self.db.get(PsychologistProfile, user.user_id) is None:
                self.db.add(
                    PsychologistProfile(
                        psychologist_id=user.user_id,
                        full_name=name,
                        approval_status="pending",
                    )
                )
        elif user.role == UserRole.ADMIN.value:
            if self.db.get(AdminProfile, user.user_id) is None:
                self.db.add(
                    AdminProfile(admin_id=user.user_id, full_name=name)
                )

        self.db.commit()
=======
        self.user_repo.ensure_role_profile(user, display_name)
>>>>>>> 5b92107a6d8d46235235e2bf29eed3fd181e3296

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
            user = self.user_repo.get_by_sub(sub)

            if user is None:
                groups = self.auth.list_user_groups(username) if username else []
<<<<<<< HEAD
                role = groups[0] if groups else UserRole.CLIENT.value
                user = self.user_repo.create(
                    User(
                        cognito_sub=sub,
                        email=claims.get("email", ""),
                        role=role,
                    )
                )
=======
                user = self.user_repo.create(User(
                    cognito_sub=sub,
                    email=claims.get("email", ""),
                    role=role_from_groups(groups),
                ))
            elif username:
                # Cognito groups are the source of truth; heal a stale local
                # role after an admin promotion or an out-of-band group edit.
                role = role_from_groups(self.auth.list_user_groups(username))
                if user.role != role:
                    user.role = role
                    self.user_repo.update(user)
>>>>>>> 5b92107a6d8d46235235e2bf29eed3fd181e3296

            self._ensure_role_profile(user, display_name=username or user.email)
        except Exception:
            return

from common.security.cognito import verify_token
from models.auth_model import (
    UserLogin,
    UserCreate,
    ConfirmUserRequest,
    ForgotPasswordConfirm
)
from models.user import User, UserRole
from repo.user_repo import UserRepository

# use DTOs on the parameters in the future
# functions that returns {"message"} have no response in cognito api

SELF_ASSIGNABLE_ROLES = {UserRole.CLIENT, UserRole.PSYCHOLOGIST}


class AuthUsecase:

    def __init__(self, service, user_repo: UserRepository | None = None):
        self.auth = service
        self.user_repo = user_repo

    def get_user(self, access_token: str):
        response = self.auth.get_user(access_token)

        return response

    def login_user(self, credentials: UserLogin):
        response = self.auth.login_user(credentials)
        self._ensure_local_user(response.get("IdToken"))

        return response

    def refresh_access_token(self, refresh_token: str):
        response = self.auth.refresh_access_token(refresh_token)

        return response

    def create_user(self, credentials: UserCreate):
        if credentials.role not in SELF_ASSIGNABLE_ROLES:
            raise ValueError("Admin role cannot be self-assigned")

        self.auth.create_user(credentials)
        self.auth.add_user_to_group(
            credentials.username, credentials.role.value)

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
        """Create the local User row from Cognito state. Idempotent."""
        if self.user_repo is None:
            return

        profile = self.auth.describe_user(username)
        groups = self.auth.list_user_groups(username)
        role = groups[0] if groups else UserRole.CLIENT.value

        if self.user_repo.get_by_cognito_sub(profile["sub"]) is None:
            self.user_repo.create(User(
                cognito_sub=profile["sub"],
                email=profile["email"],
                role=role,
            ))

    def _ensure_local_user(self, id_token: str | None):
        """Heal rows for users created before local sync existed.

        Never breaks login — sync is best-effort.
        """
        if not id_token or self.user_repo is None:
            return

        try:
            claims = verify_token(id_token)
        except Exception:
            return

        sub = claims.get("sub")

        if not sub or self.user_repo.get_by_cognito_sub(sub) is not None:
            return

        try:
            username = claims.get("cognito:username") or claims.get(
                "preferred_username", "")
            groups = self.auth.list_user_groups(username) if username else []
            role = groups[0] if groups else UserRole.CLIENT.value
            self.user_repo.create(User(
                cognito_sub=sub,
                email=claims.get("email", ""),
                role=role,
            ))
        except Exception:
            return

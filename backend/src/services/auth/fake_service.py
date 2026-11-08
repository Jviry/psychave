"""In-memory FakeAuthService for testing and offline development."""
import uuid
from typing import Any

from common.exceptions import (
    BadRequestError,
    ConflictError,
    NotFoundError,
    UnauthenticatedError,
)
from interfaces.auth import AuthService, AuthTokens, AuthUser, SignUpResult
from schemas.auth_model import (
    ConfirmUserRequest,
    ForgotPasswordConfirm,
    UserCreate,
    UserLogin,
)


class FakeAuthService(AuthService):
    """In-memory mock authentication provider."""

    def __init__(self):
        # keyed by username
        self.users_by_username: dict[str, dict[str, Any]] = {}
        # keyed by sub
        self.users_by_sub: dict[str, dict[str, Any]] = {}
        # token to sub
        self.tokens_to_sub: dict[str, str] = {}
        # confirmation codes for verification
        self.confirmation_codes: dict[str, str] = {}
        self.reset_codes: dict[str, str] = {}

    def create_user(self, credentials: UserCreate) -> SignUpResult:
        if credentials.username in self.users_by_username:
            raise ConflictError("User already exists")

        sub = str(uuid.uuid4())
        record = {
            "sub": sub,
            "username": credentials.username,
            "email": credentials.email,
            "password": credentials.password,
            "groups": [],
            "confirmed": False,
        }
        self.users_by_username[credentials.username] = record
        self.users_by_sub[sub] = record
        self.confirmation_codes[credentials.username] = "123456"

        return SignUpResult(user_sub=sub, is_confirmed=False)

    def confirm_user(self, request: ConfirmUserRequest) -> None:
        user = self.users_by_username.get(request.username)
        if not user:
            raise NotFoundError("User not found")
        expected_code = self.confirmation_codes.get(request.username, "123456")
        if request.confirmation_code != expected_code:
            raise BadRequestError("Invalid confirmation code")
        user["confirmed"] = True

    def resend_confirmation_code(self, username: str) -> None:
        if username not in self.users_by_username:
            raise NotFoundError("User not found")
        self.confirmation_codes[username] = "123456"

    def login_user(self, credentials: UserLogin) -> AuthTokens:
        user = self.users_by_username.get(credentials.username)
        if not user or user["password"] != credentials.password:
            raise UnauthenticatedError("Incorrect username or password")

        sub = user["sub"]
        access_token = f"fake-access-{sub}"
        id_token = f"fake-id-{sub}"
        refresh_token = f"fake-refresh-{sub}"

        self.tokens_to_sub[access_token] = sub
        self.tokens_to_sub[id_token] = sub
        self.tokens_to_sub[refresh_token] = sub

        return AuthTokens(
            access_token=access_token,
            id_token=id_token,
            refresh_token=refresh_token,
            token_type="Bearer",
            expires_in=3600,
        )

    def refresh_access_token(self, refresh_token: str) -> AuthTokens:
        sub = self.tokens_to_sub.get(refresh_token)
        if not sub or sub not in self.users_by_sub:
            raise UnauthenticatedError("Invalid refresh token")

        new_access = f"fake-access-{sub}"
        new_id = f"fake-id-{sub}"
        self.tokens_to_sub[new_access] = sub
        self.tokens_to_sub[new_id] = sub

        return AuthTokens(
            access_token=new_access,
            id_token=new_id,
            refresh_token=refresh_token,
            token_type="Bearer",
            expires_in=3600,
        )

    def get_user(self, access_token: str) -> AuthUser:
        sub = self.tokens_to_sub.get(access_token)
        if not sub or sub not in self.users_by_sub:
            raise UnauthenticatedError("Invalid access token")
        user = self.users_by_sub[sub]
        return AuthUser(
            sub=user["sub"],
            email=user["email"],
            username=user["username"],
            attributes={"sub": user["sub"], "email": user["email"]},
        )

    def describe_user(self, username: str) -> AuthUser:
        user = self.users_by_username.get(username)
        if not user:
            raise NotFoundError("User not found")
        return AuthUser(
            sub=user["sub"],
            email=user["email"],
            username=user["username"],
            attributes={"sub": user["sub"], "email": user["email"]},
        )

    def add_user_to_group(self, username: str, group: str) -> None:
        user = self.users_by_username.get(username)
        if not user:
            raise NotFoundError("User not found")
        if group not in user["groups"]:
            user["groups"].append(group)

    def list_user_groups(self, username: str) -> list[str]:
        user = self.users_by_username.get(username)
        if not user:
            raise NotFoundError("User not found")
        return list(user["groups"])

    def get_username_by_sub(self, sub: str) -> str | None:
        user = self.users_by_sub.get(sub)
        return user["username"] if user else None

    def get_username_by_email(self, email: str) -> str | None:
        for user in self.users_by_username.values():
            if user.get("email") == email:
                return user["username"]
        return None

    def set_user_groups(self, username: str, groups: set[str]) -> None:
        user = self.users_by_username.get(username)
        if not user:
            raise NotFoundError("User not found")
        role_groups = {"client", "psychologist", "admin"}
        unrelated = [g for g in user["groups"] if g not in role_groups]
        desired = [g for g in groups if g in role_groups]
        user["groups"] = unrelated + desired

    def set_role_group(self, username: str, role: str) -> None:
        self.set_user_groups(username, {role})

    def logout_user(self, access_token: str) -> None:
        self.tokens_to_sub.pop(access_token, None)

    def request_forgot_password(self, username: str) -> None:
        if username not in self.users_by_username:
            raise NotFoundError("User not found")
        self.reset_codes[username] = "654321"

    def confirm_forgot_password(self, request: ForgotPasswordConfirm) -> None:
        user = self.users_by_username.get(request.username)
        if not user:
            raise NotFoundError("User not found")
        expected_code = self.reset_codes.get(request.username, "654321")
        if request.confirmation_code != expected_code:
            raise BadRequestError("Invalid verification code")
        user["password"] = request.new_password

    def delete_user(self, access_token: str) -> None:
        sub = self.tokens_to_sub.get(access_token)
        if not sub or sub not in self.users_by_sub:
            raise UnauthenticatedError("Invalid access token")
        user = self.users_by_sub.pop(sub)
        self.users_by_username.pop(user["username"], None)
        self.tokens_to_sub.pop(access_token, None)

    def verify_token(self, token: str) -> dict[str, Any]:
        sub = self.tokens_to_sub.get(token)
        if not sub or sub not in self.users_by_sub:
            raise UnauthenticatedError("Invalid or expired token")
        user = self.users_by_sub[sub]
        return {
            "sub": user["sub"],
            "email": user["email"],
            "cognito:username": user["username"],
            "cognito:groups": list(user["groups"]),
        }

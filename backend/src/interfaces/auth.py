"""Authentication service interface (port) and normalized DTOs.

Decouples use cases and controllers from authentication providers (AWS Cognito,
Firebase, Supabase, local mock/fake, etc.).
"""
from dataclasses import dataclass, field
from typing import Any, Mapping, Protocol

from schemas.auth_model import (
    ConfirmUserRequest,
    ForgotPasswordConfirm,
    UserCreate,
    UserLogin,
)


@dataclass(frozen=True)
class AuthTokens:
    access_token: str
    id_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "Bearer"
    expires_in: int | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to legacy PascalCase dictionary expected by existing API consumers."""
        data: dict[str, Any] = {
            "AccessToken": self.access_token,
            "TokenType": self.token_type,
        }
        if self.id_token:
            data["IdToken"] = self.id_token
        if self.refresh_token:
            data["RefreshToken"] = self.refresh_token
        if self.expires_in is not None:
            data["ExpiresIn"] = self.expires_in
        return data


@dataclass(frozen=True)
class AuthUser:
    sub: str
    email: str
    username: str | None = None
    attributes: Mapping[str, Any] = field(default_factory=dict)

    def __getitem__(self, item: str) -> Any:
        if hasattr(self, item):
            return getattr(self, item)
        return self.attributes[item]

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        data = {
            "sub": self.sub,
            "email": self.email,
            "username": self.username,
        }
        data.update(self.attributes)
        return data


@dataclass(frozen=True)
class SignUpResult:
    user_sub: str
    is_confirmed: bool = False
    delivery_medium: str | None = None
    destination: str | None = None


class AuthService(Protocol):
    """Protocol for pluggable authentication providers."""

    def get_user(self, access_token: str) -> AuthUser:
        """Fetch user profile attributes using an active access token."""
        ...

    def login_user(self, credentials: UserLogin) -> AuthTokens:
        """Authenticate user with credentials and return tokens."""
        ...

    def refresh_access_token(self, refresh_token: str) -> AuthTokens:
        """Exchange refresh token for updated access/ID tokens."""
        ...

    def create_user(self, credentials: UserCreate) -> SignUpResult:
        """Register a new user account."""
        ...

    def confirm_user(self, request: ConfirmUserRequest) -> None:
        """Confirm user registration with verification code."""
        ...

    def resend_confirmation_code(self, username: str) -> None:
        """Resend verification code to user's registered delivery destination."""
        ...

    def add_user_to_group(self, username: str, group: str) -> None:
        """Assign user to a security/authorization group."""
        ...

    def describe_user(self, username: str) -> AuthUser:
        """Admin lookup of user details and attributes by username."""
        ...

    def list_user_groups(self, username: str) -> list[str]:
        """List groups assigned to the given username."""
        ...

    def logout_user(self, access_token: str) -> None:
        """Revoke user session/tokens."""
        ...

    def request_forgot_password(self, username: str) -> None:
        """Trigger password reset flow sending code to user."""
        ...

    def confirm_forgot_password(self, request: ForgotPasswordConfirm) -> None:
        """Complete password reset using verification code and new password."""
        ...

    def delete_user(self, access_token: str) -> None:
        """Delete user account using access token."""
        ...

    def verify_token(self, token: str) -> dict[str, Any]:
        """Validate token signature and return decoded claims."""
        ...

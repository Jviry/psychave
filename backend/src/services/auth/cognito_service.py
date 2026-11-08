"""AWS Cognito implementation of AuthService interface."""
from contextlib import contextmanager
from typing import Any
import boto3
from botocore.exceptions import ClientError

from common.exceptions import (
    BadRequestError,
    ConflictError,
    NotFoundError,
    UnauthenticatedError,
)
from common.security.cognito import verify_token as cognito_verify_token
from common.settings import settings
from interfaces.auth import AuthService, AuthTokens, AuthUser, SignUpResult
from schemas.auth_model import (
    ConfirmUserRequest,
    ForgotPasswordConfirm,
    UserCreate,
    UserLogin,
)


@contextmanager
def _handle_cognito_errors():
    """Translate botocore ClientError into application domain exceptions."""
    try:
        yield
    except ClientError as exc:
        error = exc.response.get("Error", {})
        code = error.get("Code", "")
        message = error.get("Message", "Authentication error")

        if code == "NotAuthorizedException":
            raise UnauthenticatedError(message) from exc
        if code == "UserNotFoundException":
            raise NotFoundError(message) from exc
        if code == "UsernameExistsException":
            raise ConflictError(message) from exc
        if code in (
            "InvalidPasswordException",
            "InvalidParameterException",
            "CodeMismatchException",
            "ExpiredCodeException",
        ):
            raise BadRequestError(message) from exc
        raise


class CognitoService(AuthService):
    """AWS Cognito provider implementation."""

    def __init__(
        self,
        client: Any | None = None,
        client_id: str | None = None,
        user_pool_id: str | None = None,
    ):
        self.client = client or boto3.client(
            "cognito-idp", region_name=settings.AWS_REGION
        )
        self.client_id = client_id or settings.COGNITO_APP_CLIENT_ID
        self.user_pool_id = user_pool_id or settings.COGNITO_USER_POOL_ID

    def get_user(self, access_token: str) -> AuthUser:
        with _handle_cognito_errors():
            response = self.client.get_user(AccessToken=access_token)
            attrs = {a["Name"]: a["Value"] for a in response.get("UserAttributes", [])}
            return AuthUser(
                sub=attrs.get("sub", ""),
                email=attrs.get("email", ""),
                username=response.get("Username"),
                attributes=attrs,
            )

    def login_user(self, credentials: UserLogin) -> AuthTokens:
        with _handle_cognito_errors():
            response = self.client.initiate_auth(
                ClientId=self.client_id,
                AuthFlow="USER_PASSWORD_AUTH",
                AuthParameters={
                    "USERNAME": credentials.username,
                    "PASSWORD": credentials.password,
                },
            )
            auth_result = response["AuthenticationResult"]
            return AuthTokens(
                access_token=auth_result["AccessToken"],
                id_token=auth_result.get("IdToken"),
                refresh_token=auth_result.get("RefreshToken"),
                token_type=auth_result.get("TokenType", "Bearer"),
                expires_in=auth_result.get("ExpiresIn"),
            )

    def refresh_access_token(self, refresh_token: str) -> AuthTokens:
        with _handle_cognito_errors():
            response = self.client.initiate_auth(
                ClientId=self.client_id,
                AuthFlow="REFRESH_TOKEN_AUTH",
                AuthParameters={
                    "REFRESH_TOKEN": refresh_token,
                },
            )
            auth_result = response["AuthenticationResult"]
            return AuthTokens(
                access_token=auth_result["AccessToken"],
                id_token=auth_result.get("IdToken"),
                refresh_token=auth_result.get("RefreshToken", refresh_token),
                token_type=auth_result.get("TokenType", "Bearer"),
                expires_in=auth_result.get("ExpiresIn"),
            )

    def create_user(self, credentials: UserCreate) -> SignUpResult:
        with _handle_cognito_errors():
            response = self.client.sign_up(
                ClientId=self.client_id,
                Username=credentials.username,
                Password=credentials.password,
                UserAttributes=[
                    {"Name": "email", "Value": credentials.email},
                ],
            )
            return SignUpResult(
                user_sub=response.get("UserSub", ""),
                is_confirmed=response.get("UserConfirmed", False),
            )

    def confirm_user(self, request: ConfirmUserRequest) -> None:
        with _handle_cognito_errors():
            self.client.confirm_sign_up(
                ClientId=self.client_id,
                Username=request.username,
                ConfirmationCode=request.confirmation_code,
            )

    def resend_confirmation_code(self, username: str) -> None:
        with _handle_cognito_errors():
            self.client.resend_confirmation_code(
                ClientId=self.client_id,
                Username=username,
            )

    def add_user_to_group(self, username: str, group: str) -> None:
        with _handle_cognito_errors():
            self.client.admin_add_user_to_group(
                UserPoolId=self.user_pool_id,
                Username=username,
                GroupName=group,
            )

    def describe_user(self, username: str) -> AuthUser:
        with _handle_cognito_errors():
            response = self.client.admin_get_user(
                UserPoolId=self.user_pool_id,
                Username=username,
            )
            attrs = {a["Name"]: a["Value"] for a in response.get("UserAttributes", [])}
            return AuthUser(
                sub=attrs.get("sub", ""),
                email=attrs.get("email", ""),
                username=response.get("Username", username),
                attributes=attrs,
            )

    def list_user_groups(self, username: str) -> list[str]:
        with _handle_cognito_errors():
            response = self.client.admin_list_groups_for_user(
                UserPoolId=self.user_pool_id,
                Username=username,
            )
            return [g["GroupName"] for g in response.get("Groups", [])]

    def get_username_by_sub(self, sub: str) -> str | None:
        """Resolve the Cognito username for a local user's unique sub."""
        with _handle_cognito_errors():
            response = self.client.list_users(
                UserPoolId=self.user_pool_id,
                Filter=f'sub = "{sub}"',
            )
            users = response.get("Users", [])
            return users[0]["Username"] if users else None

    def get_username_by_email(self, email: str) -> str | None:
        """Resolve the Cognito username for a local user's email."""
        with _handle_cognito_errors():
            response = self.client.list_users(
                UserPoolId=self.user_pool_id,
                Filter=f'email = "{email}"',
            )
            users = response.get("Users", [])
            return users[0]["Username"] if users else None

    def set_user_groups(self, username: str, groups: set[str]) -> None:
        """Make the user's role groups exactly ``groups``.

        Only the known role groups are managed; unrelated Cognito groups are
        left untouched. Idempotent, which also makes it safe for restoring a
        previous state.
        """
        role_groups = {"client", "psychologist", "admin"}
        desired = set(groups) & role_groups
        current = set(self.list_user_groups(username)) & role_groups

        with _handle_cognito_errors():
            for group in current - desired:
                self.client.admin_remove_user_from_group(
                    UserPoolId=self.user_pool_id,
                    Username=username,
                    GroupName=group,
                )

            for group in desired - current:
                self.client.admin_add_user_to_group(
                    UserPoolId=self.user_pool_id,
                    Username=username,
                    GroupName=group,
                )

    def set_role_group(self, username: str, role: str) -> None:
        """Replace any existing role group with a single ``role``."""
        self.set_user_groups(username, {role})

    def logout_user(self, access_token: str) -> None:
        with _handle_cognito_errors():
            self.client.global_sign_out(AccessToken=access_token)

    def request_forgot_password(self, username: str) -> None:
        with _handle_cognito_errors():
            self.client.forgot_password(
                ClientId=self.client_id,
                Username=username,
            )

    def confirm_forgot_password(self, request: ForgotPasswordConfirm) -> None:
        with _handle_cognito_errors():
            self.client.confirm_forgot_password(
                ClientId=self.client_id,
                Username=request.username,
                Password=request.new_password,
                ConfirmationCode=request.confirmation_code,
            )

    def delete_user(self, access_token: str) -> None:
        with _handle_cognito_errors():
            self.client.delete_user(AccessToken=access_token)

    def verify_token(self, token: str) -> dict[str, Any]:
        """Validate token signature and return decoded claims."""
        return cognito_verify_token(token)

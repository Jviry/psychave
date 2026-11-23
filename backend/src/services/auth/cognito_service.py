"""AWS Cognito implementation of AuthService interface."""
from contextlib import contextmanager
from typing import Any
import boto3
from botocore.exceptions import ClientError

from common.exceptions import (
    BadRequestError,
    ConflictError,
    NotFoundError,
    RateLimitError,
    UnauthenticatedError,
    UserNotConfirmedError,
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

        if code == "UserNotConfirmedException":
            raise UserNotConfirmedError("Account email is not verified.") from exc
        if code in ("LimitExceededException", "TooManyRequestsException"):
            raise RateLimitError(
                "Too many verification requests. Please wait before trying again.",
                retry_after=60,
            ) from exc
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
        if client is not None:
            self.client = client
        else:
            session_kwargs: dict[str, Any] = {}
            if settings.AWS_PROFILE:
                session_kwargs["profile_name"] = settings.AWS_PROFILE
            if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
                session_kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
                session_kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY

            session = boto3.Session(**session_kwargs)
            self.client = session.client(
                "cognito-idp", region_name=settings.AWS_REGION or None
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

    def _is_user_unconfirmed(self, username: str) -> bool:
        """Check Cognito user status without exposing existence/details on error."""
        try:
            response = self.client.admin_get_user(
                UserPoolId=self.user_pool_id,
                Username=username,
            )
            return response.get("UserStatus") == "UNCONFIRMED"
        except ClientError:
            return False

    def login_user(self, credentials: UserLogin) -> AuthTokens:
        with _handle_cognito_errors():
            try:
                response = self.client.initiate_auth(
                    ClientId=self.client_id,
                    AuthFlow="USER_PASSWORD_AUTH",
                    AuthParameters={
                        "USERNAME": credentials.username,
                        "PASSWORD": credentials.password,
                    },
                )
            except ClientError as exc:
                code = exc.response.get("Error", {}).get("Code", "")
                if code == "NotAuthorizedException" and self._is_user_unconfirmed(
                    credentials.username
                ):
                    raise UserNotConfirmedError(
                        "Account email is not verified."
                    ) from exc
                raise
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

    def create_confirmed_user(
        self, username: str, email: str, password: str
    ) -> SignUpResult:
        with _handle_cognito_errors():
            response = self.client.admin_create_user(
                UserPoolId=self.user_pool_id,
                Username=username,
                MessageAction="SUPPRESS",
                UserAttributes=[
                    {"Name": "email", "Value": email},
                    {"Name": "email_verified", "Value": "true"},
                ],
            )
            try:
                self.client.admin_set_user_password(
                    UserPoolId=self.user_pool_id,
                    Username=username,
                    Password=password,
                    Permanent=True,
                )
            except Exception:
                try:
                    self.client.admin_delete_user(
                        UserPoolId=self.user_pool_id,
                        Username=username,
                    )
                except Exception:
                    pass
                raise

            attrs = {
                a["Name"]: a["Value"]
                for a in response.get("User", {}).get("Attributes", [])
            }
            return SignUpResult(
                user_sub=attrs.get("sub", ""),
                is_confirmed=True,
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
            try:
                self.client.resend_confirmation_code(
                    ClientId=self.client_id,
                    Username=username,
                )
            except ClientError as exc:
                error = exc.response.get("Error", {})
                code = error.get("Code", "")
                message = error.get("Message", "")
                # Anti-enumeration: suppress missing or already-confirmed user errors.
                if code == "UserNotFoundException" or (
                    code == "InvalidParameterException"
                    and "already confirmed" in message.lower()
                ):
                    return
                raise

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
            try:
                self.client.forgot_password(
                    ClientId=self.client_id,
                    Username=username,
                )
            except ClientError as exc:
                error = exc.response.get("Error", {})
                code = error.get("Code", "")
                if code == "UserNotFoundException":
                    # Anti-enumeration: behave identically to a valid username.
                    return
                if code == "InvalidParameterException" and self._is_user_unconfirmed(
                    username
                ):
                    raise UserNotConfirmedError(
                        "Account email is not verified."
                    ) from exc
                raise

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

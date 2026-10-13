import boto3
from common.settings import settings
from models.auth_model import (
    UserLogin,
    UserCreate,
    ConfirmUserRequest,
    ForgotPasswordConfirm
)
from dotenv import load_dotenv
load_dotenv()


class CognitoService:

    def __init__(self):
        self.client = boto3.client(
            "cognito-idp", region_name=settings.AWS_REGION)
        self.client_id = settings.COGNITO_APP_CLIENT_ID
        self.user_pool_id = settings.COGNITO_USER_POOL_ID

    def get_user(self, access_token: str):
        response = self.client.get_user(AccessToken=access_token)

        return response

    def login_user(self, credentials: UserLogin):
        response = self.client.initiate_auth(
            ClientId=self.client_id,
            AuthFlow="USER_PASSWORD_AUTH",
            AuthParameters={
                "USERNAME": credentials.username,
                "PASSWORD": credentials.password
            }
        )

        return response["AuthenticationResult"]

    def refresh_access_token(self, refresh_token: str):
        response = self.client.initiate_auth(
            ClientId=self.client_id,
            AuthFlow="REFRESH_TOKEN_AUTH",
            AuthParameters={
                "REFRESH_TOKEN": refresh_token,
            }
        )

        return response["AuthenticationResult"]

    def create_user(self, credentials: UserCreate):
        response = self.client.sign_up(
            ClientId=self.client_id,
            Username=credentials.username,
            Password=credentials.password,
            UserAttributes=[
                {"Name": "email", "Value": credentials.email},
            ],
        )

        return response

    def confirm_user(self, request: ConfirmUserRequest):
        response = self.client.confirm_sign_up(
            ClientId=self.client_id,
            Username=request.username,
            ConfirmationCode=request.confirmation_code
        )

        return response

    def resend_confirmation_code(self, username: str):
        response = self.client.resend_confirmation_code(
            ClientId=self.client_id,
            Username=username,
        )
        return response

    def add_user_to_group(self, username: str, group: str):
        self.client.admin_add_user_to_group(
            UserPoolId=self.user_pool_id,
            Username=username,
            GroupName=group,
        )

    def describe_user(self, username: str) -> dict:
        response = self.client.admin_get_user(
            UserPoolId=self.user_pool_id,
            Username=username,
        )
        attrs = {a["Name"]: a["Value"] for a in response["UserAttributes"]}
        return {"sub": attrs["sub"], "email": attrs["email"]}

    def list_user_groups(self, username: str) -> list[str]:
        response = self.client.admin_list_groups_for_user(
            UserPoolId=self.user_pool_id,
            Username=username,
        )
        return [g["GroupName"] for g in response["Groups"]]

    def logout_user(self, access_token: str):
        self.client.global_sign_out(AccessToken=access_token)

    def request_forgot_password(self, username: str):
        self.client.forgot_password(
            ClientId=self.client_id,
            Username=username,
        )

    def confirm_forgot_password(self, request: ForgotPasswordConfirm):
        self.client.confirm_forgot_password(
            ClientId=self.client_id,
            Username=request.username,
            Password=request.new_password,
            ConfirmationCode=request.confirmation_code
        )

    def delete_user(self, access_token: str):
        self.client.delete_user(AccessToken=access_token)

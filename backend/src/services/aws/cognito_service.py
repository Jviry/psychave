import boto3
import os
from schemas.auth_model import (
    UserLogin,
    UserCreate,
    ConfirmUserRequest,
    ForgotPasswordConfirm
)
from dotenv import load_dotenv
load_dotenv()


class CognitoService:

    def __init__(self):
        self.client = boto3.client("cognito-idp")
        self.client_id = os.environ["COGNITO_APP_CLIENT_ID"]

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

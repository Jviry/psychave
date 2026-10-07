from models.auth_model import (
    UserLogin,
    UserCreate,
    ConfirmUserRequest,
    ForgotPasswordConfirm
)

# use DTOs on the parameters in the future
# functions that returns {"message"} have no response in cognito api


class AuthUsecase:

    def __init__(self, service):
        self.auth = service

    def get_user(self, access_token: str):
        response = self.auth.get_user(access_token)

        return response

    def login_user(self, credentials: UserLogin):
        response = self.auth.login_user(credentials)

        return response

    def refresh_access_token(self, refresh_token: str):
        response = self.auth.refresh_access_token(refresh_token)

        return response

    def create_user(self, credentials: UserCreate):
        self.auth.create_user(credentials)

        return {"message": "register successful, check email for code"}

    def confirm_user(self, credentials: ConfirmUserRequest):
        self.auth.confirm_user(credentials)

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

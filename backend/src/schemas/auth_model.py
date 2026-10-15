from pydantic import BaseModel, EmailStr

from models.user import UserRole


class UserLogin(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str
    role: UserRole = UserRole.CLIENT


class ConfirmUserRequest(BaseModel):
    username: str
    confirmation_code: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ForgotPasswordConfirm(BaseModel):
    username: str
    new_password: str
    confirmation_code: str


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    confirmation_code: str
    new_password: str

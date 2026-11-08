from pydantic import BaseModel, EmailStr


class UserLogin(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    """Self-service signup always creates a client account.

    Roles are assigned by admins after registration, so this payload
    deliberately has no ``role`` field. Pydantic ignores unknown fields, so
    older clients that still send ``role`` cannot self-assign a group.
    """

    email: EmailStr
    username: str
    password: str


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

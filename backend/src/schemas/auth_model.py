from pydantic import BaseModel, EmailStr, model_validator

from models.profile import ProfileRelation
from schemas.profile import (
    ConsentCreate,
    MINOR_CUTOFF_AGE,
    ProfileCreate,
    _calculate_age,
)


class UserLogin(BaseModel):
    username: str
    password: str


class UserCreate(BaseModel):
    """Self-service signup always creates a client account and its primary 'self' profile.

    Roles are assigned by admins after registration, so this payload
    deliberately has no ``role`` field. Pydantic ignores unknown fields, so
    older clients that still send ``role`` cannot self-assign a group.
    """

    email: EmailStr
    username: str
    password: str
    profile: ProfileCreate
    consent: ConsentCreate

    @model_validator(mode="after")
    def check_self_profile_and_adult(self):
        if self.profile.relation_to_account_holder != ProfileRelation.self_:
            raise ValueError("Registration profile relation must be 'self'")
        if self.consent.terms_signer_relation != "self":
            raise ValueError("Registration consent signer relation must be 'self'")
        if _calculate_age(self.profile.date_of_birth) < MINOR_CUTOFF_AGE:
            raise ValueError(
                "Account holder must be at least 18 years old to register"
            )
        return self


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

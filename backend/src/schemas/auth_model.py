from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator, model_validator

from models.profile import ProfileRelation
from schemas.profile import (
    ConsentCreate,
    MINOR_CUTOFF_AGE,
    ProfileCreate,
    _calculate_age,
)
from schemas.psychologist import SocialMediaLink


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


class AccessTokenRequest(BaseModel):
    access_token: str


class ForgotPasswordConfirm(BaseModel):
    username: str
    new_password: str
    confirmation_code: str


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    confirmation_code: str
    new_password: str


class PsychologistInvitationVerifyRead(BaseModel):
    email: EmailStr
    expires_at: datetime


class PsychologistInviteRegisterRequest(BaseModel):
    token: str
    username: str
    password: str
    full_name: str
    license_number: str
    specialization: str
    bio: str
    social_media_links: list[SocialMediaLink]

    @field_validator(
        "token",
        "username",
        "full_name",
        "license_number",
        "specialization",
        "bio",
    )
    @classmethod
    def not_blank(cls, value: str, info) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError(f"{info.field_name} cannot be blank")
        return cleaned

    @field_validator("social_media_links")
    @classmethod
    def require_at_least_one_social_link(
        cls, value: list[SocialMediaLink]
    ) -> list[SocialMediaLink]:
        if not value:
            raise ValueError(
                "At least one social media contact link is required"
            )
        return value

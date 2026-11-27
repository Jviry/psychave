import math
import uuid
from datetime import datetime

from pydantic import EmailStr, field_validator, model_validator
from sqlmodel import Field, SQLModel

from models.user import UserRole
from schemas.psychologist import SocialMediaLink


class AdminUserRead(SQLModel):
    user_id: uuid.UUID
    email: str
    role: UserRole
    full_name: str | None = None
    created_at: datetime


class AdminUserPage(SQLModel):
    items: list[AdminUserRead]
    total: int
    page: int
    page_size: int


class UpdateUserRoleRequest(SQLModel):
    """Admin role change. ``full_name`` is required when the target role has
    a name-bearing profile row (psychologist/admin) and none exists yet."""

    role: UserRole
    full_name: str | None = None

    @field_validator("full_name")
    @classmethod
    def strip_full_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class PromotePsychologistRequest(SQLModel):
    """Profile details an admin supplies when promoting a client.

    Only ``full_name`` is required; the rest can be filled in later by the
    psychologist via ``PATCH /psychologist-profile/me``.
    """

    full_name: str
    license_number: str | None = None
    specialization: str | None = None
    bio: str | None = None
    social_media_links: list[SocialMediaLink] = Field(default_factory=list)

    @field_validator("full_name")
    @classmethod
    def full_name_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Full name is required")
        return value


class PsychologistInvitationCreate(SQLModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class PsychologistInvitationRead(SQLModel):
    invitation_id: uuid.UUID
    email: str
    invitation_url: str
    expires_at: datetime
    created_at: datetime


class ManualPaymentConfirmRequest(SQLModel):
    note: str | None = None

    @field_validator("note")
    @classmethod
    def strip_note(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None


class AdminRefundRequest(SQLModel):
    amount_centavos: int | None = None
    percentage: float | None = None
    reason: str

    @field_validator("reason")
    @classmethod
    def reason_not_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Refund reason is required")
        return cleaned

    @model_validator(mode="after")
    def validate_amount_or_percentage(self) -> "AdminRefundRequest":
        if self.amount_centavos is not None and self.percentage is not None:
            raise ValueError("Provide either amount_centavos or percentage, not both")
        if self.amount_centavos is None and self.percentage is None:
            raise ValueError("Provide either amount_centavos or percentage for the refund")
        if self.amount_centavos is not None and self.amount_centavos <= 0:
            raise ValueError("amount_centavos must be greater than zero")
        if self.percentage is not None:
            if not math.isfinite(self.percentage) or self.percentage <= 0 or self.percentage >= 100:
                raise ValueError("percentage must be strictly between 0 and 100")
        return self

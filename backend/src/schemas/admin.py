import uuid
from datetime import datetime

from pydantic import field_validator
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

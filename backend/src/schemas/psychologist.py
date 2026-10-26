import uuid
from datetime import date, time
from pydantic import field_validator
from sqlmodel import Field, SQLModel


class SocialMediaLink(SQLModel):
    platform: str
    url: str

    @field_validator("platform")
    @classmethod
    def platform_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Social media platform is required")
        return value

    @field_validator("url")
    @classmethod
    def valid_url(cls, value: str) -> str:
        value = value.strip()
        if not value.startswith(("http://", "https://")):
            raise ValueError("Social media URL must start with http:// or https://")
        return value


class PsychologistProfileRead(SQLModel):
    psychologist_id: uuid.UUID
    full_name: str
    license_number: str | None
    specialization: str | None
    bio: str | None
    social_media_links: list[SocialMediaLink] = Field(default_factory=list)


class PsychologistProfileUpdate(SQLModel):
    """Writable profile fields."""
    specialization: str | None = None
    license_number: str | None = None
    bio: str | None = None
    social_media_links: list[SocialMediaLink] | None = None


class PickupRequest(SQLModel):
    price: float


class SlotProposal(SQLModel):
    session_date: date
    start_time: time
    end_time: time | None = None

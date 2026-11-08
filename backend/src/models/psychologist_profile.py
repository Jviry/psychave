import uuid
from sqlalchemy import JSON, Column
from sqlmodel import SQLModel, Field


class PsychologistProfile(SQLModel, table=True):
    __tablename__: str = "psychologist_profiles"
    psychologist_id: uuid.UUID = Field(foreign_key="users.user_id", primary_key=True)
    full_name: str
    license_number: str | None = None
    # nullable: filled in later by the psychologist via PATCH /psychologist-profile/me
    specialization: str | None = None
    bio: str | None = None
    # [{ "platform": "Facebook", "url": "https://..." }] — required before
    # accepting a booking so confirmed clients have a real contact channel.
    social_media_links: list[dict[str, str]] = Field(
        default_factory=list,
        sa_column=Column(JSON, nullable=False, default=list),
    )

import uuid
from datetime import datetime
from sqlmodel import SQLModel, Field


class PsychologistProfile(SQLModel, table=True):
    __tablename__: str = "psychologist_profiles"
    psychologist_id: uuid.UUID = Field(foreign_key="users.user_id", primary_key=True)
    full_name: str
    license_number: str | None = None
    # nullable: filled in later by the psychologist via PATCH /psychologist-profile/me
    specialization: str | None = None
    bio: str | None = None
    approval_status: str = "pending"
    approved_by: uuid.UUID | None = Field(
        default=None, foreign_key="admin_profiles.admin_id"
    )
    approved_at: datetime | None = None

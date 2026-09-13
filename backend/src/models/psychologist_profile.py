import uuid
from datetime import datetime
from sqlmodel import SQLModel, Field


class PsychologistProfile(SQLModel, table=True):
    __tablename__: str = "psychologist_profiles"
    psychologist_id: uuid.UUID = Field(foreign_key="users.user_id", primary_key=True)
    full_name: str
    liscence_number: str | None = None
    specialization: str
    approval_status: str = "pending"
    approved_by: uuid.UUID | None = Field(
        default=None, foreign_key="admin_profiles.admin_id"
    )
    approved_at: datetime | None = None

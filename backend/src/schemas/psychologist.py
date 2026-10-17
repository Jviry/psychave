import uuid
from datetime import date, datetime, time
from sqlmodel import SQLModel


class PsychologistProfileRead(SQLModel):
    psychologist_id: uuid.UUID
    full_name: str
    license_number: str | None
    specialization: str | None
    bio: str | None
    approval_status: str
    approved_by: uuid.UUID | None
    approved_at: datetime | None


class PsychologistProfileUpdate(SQLModel):
    """Writable profile fields — approval fields are deliberately excluded."""
    specialization: str | None = None
    license_number: str | None = None
    bio: str | None = None


class PickupRequest(SQLModel):
    price: float


class SlotProposal(SQLModel):
    session_date: date
    start_time: time
    end_time: time | None = None

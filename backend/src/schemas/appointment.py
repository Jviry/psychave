import uuid
from datetime import date, datetime, time
from sqlmodel import SQLModel

from models.appointment import AppointmentStatus


class AppointmentCreate(SQLModel):
    persona_id: uuid.UUID
    service_id: uuid.UUID
    presenting_concern: str


class AppointmentRead(SQLModel):
    appointment_id: uuid.UUID
    persona_id: uuid.UUID
    service_id: uuid.UUID
    psychologist_id: uuid.UUID | None
    selected_slot_id: uuid.UUID | None
    price: float | None
    presenting_concern: str
    status: AppointmentStatus
    requested_datetime: datetime | None


class ProposedSlotRead(SQLModel):
    slot_id: uuid.UUID
    session_date: date
    start_time: time
    end_time: time | None


class SlotSelect(SQLModel):
    slot_id: uuid.UUID

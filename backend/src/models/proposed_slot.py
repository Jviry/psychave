import uuid
from datetime import date, time
from sqlmodel import SQLModel, Field


class ProposedSlot(SQLModel, table=True):
    __tablename__: str = "proposed_slots"
    slot_id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    appointment_id: uuid.UUID = Field(foreign_key="appointments.appointment_id")
    session_date: date
    start_time: time
    end_time: time | None = None

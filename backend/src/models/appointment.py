import uuid
from enum import Enum
from datetime import datetime
from sqlmodel import SQLModel, Field


class AppointmentStatus(str, Enum):
    PENDING = "pending"
    AWAITING_SLOT_SELECTION = "awaiting_slot_selection"
    AWAITING_PAYMENT = "awaiting_payment"
    CANCELLED = "cancelled"


class Appointment(SQLModel, table=True):
    __tablename__: str = "appointments"
    appointment_id: uuid.UUID = Field(
        default_factory=uuid.uuid4, primary_key=True)
    persona_id: uuid.UUID = Field(foreign_key="persona.persona_id")
    selected_slot_id: uuid.UUID | None = Field(
        default=None, foreign_key="proposed_slots.slot_id"
    )
    psychologist_id: uuid.UUID | None = Field(
        default=None, foreign_key="psychologist_profiles.psychologist_id"
    )
    price: float | None = None
    requested_datetime: datetime | None = None
    status: AppointmentStatus = Field(default=AppointmentStatus.PENDING)
    service_id: uuid.UUID = Field(foreign_key="services.service_id")
    presenting_concern: str

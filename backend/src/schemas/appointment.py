import uuid
from datetime import date, datetime, time
from sqlmodel import SQLModel, Field

from models.appointment import AppointmentStatus
from schemas.psychologist import SocialMediaLink


class AppointmentCreate(SQLModel):
    persona_id: uuid.UUID
    service_id: uuid.UUID
    presenting_concern: str


class ProposedSlotRead(SQLModel):
    slot_id: uuid.UUID
    session_date: date
    start_time: time
    end_time: time | None


class AppointmentRead(SQLModel):
    appointment_id: uuid.UUID
    persona_id: uuid.UUID
    persona_name: str
    persona_relation: str
    service_id: uuid.UUID
    service_name: str
    service_duration_minutes: int | None = None
    service_guardrail: str | None = None
    psychologist_id: uuid.UUID | None
    selected_slot_id: uuid.UUID | None
    price: float | None
    presenting_concern: str
    status: AppointmentStatus
    requested_datetime: datetime | None
    proposed_slots: list[ProposedSlotRead] = Field(default_factory=list)
    # Contact channels are only exposed after the booking is confirmed.
    persona_socmed_platform: str | None = None
    persona_socmed_username: str | None = None
    psychologist_social_links: list[SocialMediaLink] = Field(default_factory=list)


class SlotSelect(SQLModel):
    slot_id: uuid.UUID

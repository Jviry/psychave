import uuid
from datetime import date, datetime, time
from urllib.parse import urlparse
from pydantic import field_validator
from sqlmodel import SQLModel, Field

from models.appointment import AppointmentStatus, SchedulingTurn
from models.proposed_slot import SlotProposer, SlotStatus


class SlotInput(SQLModel):
    """A date/start-time preference; end time is derived from the service."""

    session_date: date
    start_time: time


from schemas.psychologist import SocialMediaLink


class AppointmentCreate(SQLModel):
    profile_id: uuid.UUID
    service_id: uuid.UUID
    presenting_concern: str
    preferred_slots: list[SlotInput] = Field(min_length=3, max_length=5)


class PreferredSlotsUpdate(SQLModel):
    slots: list[SlotInput] = Field(min_length=3, max_length=5)


class ProposedSlotRead(SQLModel):
    slot_id: uuid.UUID
    session_date: date
    start_time: time
    end_time: time | None
    proposed_by: SlotProposer
    status: SlotStatus
    round: int


class AppointmentRead(SQLModel):
    appointment_id: uuid.UUID
    profile_id: uuid.UUID
    profile_name: str
    profile_relation: str
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
    scheduling_turn: SchedulingTurn | None = None
    scheduling_round: int = 1
    payment_deadline: datetime | None = None
    reschedule_fee_waived: bool = False
    reschedule_requested_by: str | None = None
    reschedule_reason: str | None = None
    reschedule_waiver_reason: str | None = None
    refund_amount_centavos: int | None = None
    refund_reason: str | None = None
    refunded_at: datetime | None = None
    is_session_paid: bool = False
    proposed_slots: list[ProposedSlotRead] = Field(default_factory=list)
    conflicting_slot_ids: list[uuid.UUID] = Field(default_factory=list)
    # Client contact details are visible to the assigned psychologist at every
    # stage; psychologist contact links only unlock after confirmation.
    profile_socmed_platform: str | None = None
    profile_socmed_username: str | None = None
    psychologist_social_links: list[SocialMediaLink] = Field(default_factory=list)
    meeting_link: str | None = None
    reminder_24h_sent_at: datetime | None = None
    reminder_1h_sent_at: datetime | None = None


class PendingAppointmentRead(AppointmentRead):
    """Pending-queue row annotated for the *calling* psychologist."""

    pass


class SlotSelect(SQLModel):
    slot_id: uuid.UUID


class RescheduleRequest(SQLModel):
    reason: str | None = None
    preferred_slots: list[SlotInput] | None = Field(
        default=None, min_length=3, max_length=5
    )


class WaiveRescheduleFeeRequest(SQLModel):
    reason: str | None = None


class MeetingLinkUpdate(SQLModel):
    meeting_link: str

    @field_validator("meeting_link")
    @classmethod
    def validate_meeting_link(cls, value: str) -> str:
        cleaned = value.strip()
        parsed = urlparse(cleaned)
        if parsed.scheme != "https" or not parsed.netloc:
            raise ValueError("Meeting link must be a valid https:// URL")
        return cleaned

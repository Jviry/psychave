import uuid
from enum import Enum
from datetime import date, time
from sqlmodel import SQLModel, Field


class SlotProposer(str, Enum):
    CLIENT = "client"
    PSYCHOLOGIST = "psychologist"


class SlotStatus(str, Enum):
    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    EXPIRED = "expired"


class ProposedSlot(SQLModel, table=True):
    __tablename__: str = "proposed_slots"
    slot_id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    appointment_id: uuid.UUID = Field(foreign_key="appointments.appointment_id")
    session_date: date
    start_time: time
    end_time: time | None = None
    # Who offered this time. Client preferences arrive with the booking;
    # psychologist counter-offers arrive after pickup.
    proposed_by: SlotProposer = Field(default=SlotProposer.PSYCHOLOGIST)
    status: SlotStatus = Field(default=SlotStatus.PROPOSED)
    round: int = Field(default=1)

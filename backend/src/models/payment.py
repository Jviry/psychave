import uuid
from datetime import datetime, timezone
from enum import Enum
from sqlmodel import SQLModel, Field


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"


class Payment(SQLModel, table=True):
    __tablename__: str = "payments"
    payment_id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    appointment_id: uuid.UUID = Field(foreign_key="appointments.appointment_id")
    amount: float
    payment_method: str | None = None
    provider: str = "fake"
    provider_ref: str | None = Field(default=None, index=True)
    checkout_url: str | None = None
    status: PaymentStatus = PaymentStatus.PENDING
    paid_at: datetime | None = None
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc))

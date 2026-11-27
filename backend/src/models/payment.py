import uuid
from datetime import datetime, timezone
from enum import Enum
from sqlmodel import SQLModel, Field


class PaymentStatus(str, Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"
    PARTIALLY_REFUNDED = "partially_refunded"


class PaymentType(str, Enum):
    SESSION = "session"
    RESCHEDULE_FEE = "reschedule_fee"


class Payment(SQLModel, table=True):
    __tablename__: str = "payments"
    payment_id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    appointment_id: uuid.UUID = Field(foreign_key="appointments.appointment_id")
    amount: float
    payment_type: PaymentType = Field(default=PaymentType.SESSION)
    payment_method: str | None = None
    provider: str = "paymongo"
    provider_ref: str | None = Field(default=None, index=True)
    gateway_payment_id: str | None = Field(default=None, index=True)
    checkout_url: str | None = None
    status: PaymentStatus = PaymentStatus.PENDING
    paid_at: datetime | None = None
    refund_amount_centavos: int | None = None
    refund_ref: str | None = None
    refund_reason: str | None = None
    refunded_at: datetime | None = None
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc))

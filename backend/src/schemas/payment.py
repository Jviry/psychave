import uuid
from datetime import datetime
from typing import Literal
from sqlmodel import SQLModel

from models.payment import PaymentStatus


class PaymentInitiateRequest(SQLModel):
    payment_method: str | None = None


class PaymentRead(SQLModel):
    payment_id: uuid.UUID
    appointment_id: uuid.UUID
    amount: float
    payment_method: str | None = None
    provider: str
    provider_ref: str | None = None
    checkout_url: str | None = None
    status: PaymentStatus
    paid_at: datetime | None = None
    created_at: datetime


class PaymentWebhookRequest(SQLModel):
    provider_ref: str
    outcome: Literal["paid", "failed"]
    payment_method: str | None = None

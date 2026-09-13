import uuid
from datetime import datetime
from sqlmodel import SQLModel, Field


class Payment(SQLModel, table=True):
    __tablename__: str = "payments"
    payment_id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    appointment_id: uuid.UUID = Field(foreign_key="appointments.appointment_id")
    amount: float
    payment_method: str | None = None
    status: str = "pending"
    paid_at: datetime | None = None

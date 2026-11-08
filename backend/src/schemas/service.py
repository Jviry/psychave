import uuid
from sqlmodel import SQLModel


class ServiceRead(SQLModel):
    service_id: uuid.UUID
    name: str
    description: str
    is_active: bool
    duration_minutes: int
    guardrail_notice: str | None = None

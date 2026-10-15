import uuid
from sqlmodel import SQLModel


class ServiceRead(SQLModel):
    service_id: uuid.UUID
    name: str
    description: str

import uuid
from sqlmodel import SQLModel, Field


class Service(SQLModel, table=True):
    __tablename__: str = "services"
    service_id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    name: str
    description: str
    is_active: bool = True

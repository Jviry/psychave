import uuid
from sqlmodel import SQLModel, Field


class Persona(SQLModel, table=True):
    __tablename__: str = "persona"
    persona_id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    full_name: str
    client_id: uuid.UUID = Field(foreign_key="client_profiles.client_id")

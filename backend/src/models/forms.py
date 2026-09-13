import uuid
from sqlmodel import SQLModel, Field


class Forms(SQLModel, table=True):
    __tablename__: str = "forms"
    form_id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    persona_id: uuid.UUID = Field(foreign_key="persona.persona_id")

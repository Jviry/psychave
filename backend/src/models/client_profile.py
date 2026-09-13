import uuid
from sqlmodel import SQLModel, Field


class ClientProfile(SQLModel, table=True):
    __tablename__: str = "client_profiles"
    client_id: uuid.UUID = Field(foreign_key="users.user_id", primary_key=True)

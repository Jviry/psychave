import uuid
from datetime import datetime, timezone
from sqlmodel import SQLModel, Field


class User(SQLModel, table=True):
    __tablename__: str = "users"
    user_id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    cognito_sub: str = Field(unique=True, index=True)
    email: str
    role: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

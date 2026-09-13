import uuid
from sqlmodel import SQLModel, Field


class AdminProfile(SQLModel, table=True):
    __tablename__: str = "admin_profiles"
    admin_id: uuid.UUID = Field(foreign_key="users.user_id", primary_key=True)
    full_name: str

from datetime import date
from enum import Enum
from typing import Any
import uuid
import sqlalchemy as sa
from sqlmodel import Column, Field, SQLModel


class ProfileRelation(str, Enum):
    self_ = "self"
    child = "child"
    spouse = "spouse"
    parent = "parent"
    sibling = "sibling"
    other = "other"


class ContactMode(str, Enum):
    phone = "phone"
    email = "email"
    messenger = "messenger"
    instagram = "instagram"


class Profile(SQLModel, table=True):
    __tablename__: str = "profiles"
    profile_id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    client_id: uuid.UUID = Field(foreign_key="client_profiles.client_id")
    relation_to_account_holder: ProfileRelation = ProfileRelation.self_

    profile_name: str
    date_of_birth: date
    socmed_platform: str | None = None
    socmed_username: str | None = None
    details: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(sa.JSON(), nullable=False),
    )

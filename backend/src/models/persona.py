from enum import Enum
from datetime import date
import uuid
from sqlmodel import SQLModel, Field


class PersonaRelation(str, Enum):
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


class Persona(SQLModel, table=True):
    __tablename__: str = "persona"
    persona_id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    client_id: uuid.UUID = Field(foreign_key="client_profiles.client_id")
    relation_to_account_holder: PersonaRelation = PersonaRelation.self_

    persona_name: str
    date_of_birth: date
    occupation: str | None = None
    nationality: str
    permanent_address: str
    present_address: str
    contact_number: str
    socmed_platform: str | None = None
    socmed_username: str | None = None
    preferred_contact_mode: ContactMode

    emergency_contact_name: str
    emergency_contact_relation: str
    emergency_contact_number: str

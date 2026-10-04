import uuid
from datetime import date
from sqlmodel import SQLModel


class PersonaCreate(SQLModel):
    relation_to_account_holder: str
    # "self" | "child" | "spouse" | "parent" | "sibling" | "other"
    persona_name: str
    date_of_birth: str
    occupation: str | None = None
    nationality: str
    permanent_address: str
    present_address: str
    contact_number: str
    socmed_platform: str | None = None
    socmed_username: str | None = None
    preferred_contact_mode: str
    # "phone" | "email" | "messenger" | "instagram"
    emergency_contact_mode: str
    emergency_contact_relation: str
    emergency_contact_number: str


class ConsentCreate(SQLModel):
    consent_version: str
    terms_signer_name: str
    terms_signer_relation: str
    scope_acknowledged: bool
    is_overseas_or_foreign: bool = False
    overseas_acknowledged: bool = False
    information_confirmed: bool
    consent_signer_name: str


class PersonaWithConsentCreate(SQLModel):
    persona: PersonaCreate
    consent: ConsentCreate


class PersonaRead(SQLModel):
    persona_id: uuid.UUID
    relation_to_account_holder: str
    persona_name: str
    date_of_birth: date
    nationality: str
    contact_number: str
    preferred_contact_mode: str

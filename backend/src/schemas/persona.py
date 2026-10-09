import uuid
from datetime import date
from pydantic import field_validator, model_validator
from sqlmodel import SQLModel

MINOR_CUTOFF_AGE = 18


def _calculate_age(dob: date) -> int:
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


class PersonaCreate(SQLModel):
    relation_to_account_holder: str
    # "self" | "child" | "spouse" | "parent" | "sibling" | "other"
    persona_name: str
    date_of_birth: date
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

    @field_validator("date_of_birth")
    @classmethod
    def dob_not_in_future(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("Date of birth cannot be in the future")
        return v


class ConsentCreate(SQLModel):
    consent_version: str
    terms_signer_name: str
    terms_signer_relation: str
    scope_acknowledged: bool
    is_overseas_or_foreign: bool = False
    overseas_acknowledged: bool = False
    information_confirmed: bool
    consent_signer_name: str

    @model_validator(mode="after")
    def check_acknowledgements(self):
        if not self.scope_acknowledged:
            raise ValueError("Scope acknowledgement is required")
        if not self.information_confirmed:
            raise ValueError("Information accuracy confirmation is required")
        if self.is_overseas_or_foreign and not self.overseas_acknowledged:
            raise ValueError(
                "Overseas/foreign acknowledgement is required when is_overseas_or_foreign is true"
            )
        if self.terms_signer_name.strip().lower() != self.consent_signer_name.strip().lower():
            raise ValueError("Terms signer name and consent signer name must match")
        return self


class PersonaWithConsentCreate(SQLModel):
    persona: PersonaCreate
    consent: ConsentCreate

    @model_validator(mode="after")
    def check_minor_signer(self):
        is_minor = _calculate_age(self.persona.date_of_birth) < MINOR_CUTOFF_AGE
        if is_minor and self.consent.terms_signer_relation == "self":
            raise ValueError(
                "A minor's consent cannot be signed as 'self' — provide the signer's relation"
            )
        return self


class PersonaRead(SQLModel):
    persona_id: uuid.UUID
    relation_to_account_holder: str
    persona_name: str
    date_of_birth: date
    nationality: str
    contact_number: str
    preferred_contact_mode: str

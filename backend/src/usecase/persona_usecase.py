import uuid
from datetime import date
from fastapi import HTTPException
from sqlmodel import Session

from repo.persona_repo import PersonaRepo
from schemas.persona import PersonaWithConsentCreate

CURRENT_CONSENT_VERSION = "v1"
MINOR_CUTOFF_AGE = 18


def _calculate_age(dob: date) -> int:
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


class PersonaUsecase:
    def __init__(self, db: Session):
        self.db = db
        self.repo = PersonaRepo(db)

    def create_persona(self, payload: PersonaWithConsentCreate, client_id: uuid.UUID):
        persona_data = payload.persona
        consent_data = payload.consent

        if persona_data.date_of_birth > date.today():
            raise HTTPException(
                status_code=422, detail="Date of birth cannot be in the future")

        is_minor = _calculate_age(
            persona_data.date_of_birth) < MINOR_CUTOFF_AGE
        if is_minor and consent_data.terms_signer_relation == "self":
            raise HTTPException(
                status_code=422,
                detail="A minor's consent cannot be signed as 'self' — provide the signer's relation",
            )

        if not consent_data.scope_acknowledged:
            raise HTTPException(
                status_code=422, detail="Scope acknowledgement is required")

        if not consent_data.information_confirmed:
            raise HTTPException(
                status_code=422, detail="Information accuracy confirmation is required")

        if consent_data.is_overseas_or_foreign and not consent_data.overseas_acknowledged:
            raise HTTPException(
                status_code=422,
                detail="Overseas/foreign acknowledgement is required when is_overseas_or_foreign is true",
            )

        if consent_data.terms_signer_name.strip().lower() != consent_data.consent_signer_name.strip().lower():
            raise HTTPException(
                status_code=422,
                detail="Terms signer name and consent signer name must match",
            )

        if consent_data.consent_version != CURRENT_CONSENT_VERSION:
            raise HTTPException(
                status_code=409,
                detail=f"Consent form is outdated — current version is {
                    CURRENT_CONSENT_VERSION}",
            )

        return self.repo.create_with_consent(client_id, persona_data, consent_data)

    def list_personas(self, client_id: uuid.UUID):
        return self.repo.get_for_client(client_id)

    def get_persona(self, persona_id: uuid.UUID, client_id: uuid.UUID):
        persona = self.repo.get_by_id(persona_id)
        if persona is None or persona.client_id != client_id:
            raise HTTPException(status_code=404, detail="Persona not found")
        return persona

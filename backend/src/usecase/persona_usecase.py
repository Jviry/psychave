import uuid
from sqlmodel import Session

from common.exceptions import ConflictError, NotFoundError, ValidationError
from repo.persona_repo import PersonaRepo
from schemas.persona import (
    PersonaCreate,
    PersonaWithConsentCreate,
    ConsentRead,
    PersonaRead,
    MINOR_CUTOFF_AGE,
    _calculate_age,
)

CURRENT_CONSENT_VERSION = "v2"


class PersonaUsecase:
    def __init__(self, db: Session):
        self.db = db
        self.repo = PersonaRepo(db)

    def create_persona(self, payload: PersonaWithConsentCreate, client_id: uuid.UUID):
        consent_data = payload.consent

        if consent_data.consent_version != CURRENT_CONSENT_VERSION:
            raise ConflictError(
                f"Consent form is outdated — current version is {CURRENT_CONSENT_VERSION}",
            )

        return self.repo.create_with_consent(client_id, payload.persona, consent_data)

    def list_personas(self, client_id: uuid.UUID):
        return self.repo.get_for_client(client_id)

    def get_persona(self, persona_id: uuid.UUID, client_id: uuid.UUID):
        persona = self.repo.get_by_id(persona_id)
        if persona is None or persona.client_id != client_id:
            raise NotFoundError("Persona not found")
        return persona

    def delete_persona(self, persona_id: uuid.UUID, client_id: uuid.UUID) -> PersonaRead:
        persona = self.repo.get_by_id(persona_id)
        if persona is None or persona.client_id != client_id:
            raise NotFoundError("Persona not found")
        if self.repo.has_active_appointments(persona_id):
            raise ConflictError(
                "Cannot delete persona with active appointments")
        # Snapshot before delete — the session expires attributes on commit.
        deleted = PersonaRead.model_validate(persona)
        self.repo.delete_persona(persona_id)
        return deleted

    def update_persona(
        self, persona_id: uuid.UUID, data: PersonaCreate, client_id: uuid.UUID
    ):
        persona = self.repo.get_by_id(persona_id)
        if persona is None or persona.client_id != client_id:
            raise NotFoundError("Persona not found")

        form = self.repo.get_latest_form(persona_id)
        if (
            form is not None
            and _calculate_age(data.date_of_birth) < MINOR_CUTOFF_AGE
            and form.terms_signer_relation == "self"
        ):
            raise ValidationError(
                "A minor's consent cannot be signed as 'self' — provide the signer's relation"
            )

        return self.repo.update_persona(persona, data)

    def get_persona_for_psychologist(self, persona_id: uuid.UUID):
        persona = self.repo.get_by_id(persona_id)
        if persona is None:
            raise NotFoundError("Persona not found")

        form = self.repo.get_latest_form(persona_id)
        if form is None:
            raise NotFoundError("Consent form not found")

        return {
            "persona": PersonaRead.model_validate(persona),
            "consent": ConsentRead.model_validate(form)
        }

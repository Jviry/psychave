import uuid
from sqlmodel import Session, select
from models.persona import Persona
from models.forms import Forms
from schemas.persona import PersonaCreate, ConsentCreate


class PersonaRepo:
    def __init__(self, db: Session):
        self.db = db

    def create_with_consent(
        self, client_id: uuid.UUID, persona_data: PersonaCreate, consent_data: ConsentCreate
    ) -> Persona:
        persona = Persona(client_id=client_id, **persona_data.model_dump())
        self.db.add(persona)
        self.db.flush()

        form = Forms(persona_id=persona.persona_id,
                     **consent_data.model_dump())
        self.db.add(form)

        self.db.commit()
        self.db.refresh(persona)
        return persona

    def get_for_client(self, client_id: uuid.UUID) -> list[Persona]:
        return self.db.exec(select(Persona).where(Persona.client_id == client_id)).all()

    def get_by_id(self, persona_id: uuid.UUID) -> Persona | None:
        return self.db.get(Persona, persona_id)

    def get_latest_form(self, persona_id: uuid.UUID) -> Forms | None:
        return self.db.exec(
            select(Forms)
            .where(Forms.persona_id == persona_id)
            .order_by(Forms.signed_at.desc())
        ).first()

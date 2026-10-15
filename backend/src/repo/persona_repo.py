import uuid
from sqlmodel import Session, select
from models.persona import Persona
from models.forms import Forms
from models.appointment import Appointment, AppointmentStatus
from models.proposed_slot import ProposedSlot
from schemas.persona import PersonaCreate, ConsentCreate

# Appointments in these statuses keep their persona alive — delete is blocked.
# CONFIRMED included: paid history must survive for records.
ACTIVE_APPOINTMENT_STATUSES = (
    AppointmentStatus.PENDING,
    AppointmentStatus.AWAITING_SLOT_SELECTION,
    AppointmentStatus.AWAITING_PAYMENT,
    AppointmentStatus.CONFIRMED,
)


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

    def update_persona(self, persona: Persona, data: PersonaCreate) -> Persona:
        for field, value in data.model_dump().items():
            setattr(persona, field, value)
        self.db.add(persona)
        self.db.commit()
        self.db.refresh(persona)
        return persona

    def get_latest_form(self, persona_id: uuid.UUID) -> Forms | None:
        return self.db.exec(
            select(Forms)
            .where(Forms.persona_id == persona_id)
            .order_by(Forms.signed_at.desc())
        ).first()

    def has_active_appointments(self, persona_id: uuid.UUID) -> bool:
        return self.db.exec(
            select(Appointment.appointment_id)
            .where(
                Appointment.persona_id == persona_id,
                Appointment.status.in_(ACTIVE_APPOINTMENT_STATUSES),
            )
        ).first() is not None

    def delete_persona(self, persona_id: uuid.UUID) -> None:
        """Delete a persona plus its forms and inactive appointment history.

        Cancelled appointments and their proposed slots are removed too,
        otherwise their non-nullable persona_id FK would be violated.
        Callers must block on has_active_appointments() first.
        """
        appointment_ids = self.db.exec(
            select(Appointment.appointment_id).where(
                Appointment.persona_id == persona_id
            )
        ).all()
        for slot in self.db.exec(
            select(ProposedSlot).where(
                ProposedSlot.appointment_id.in_(appointment_ids)
            )
        ).all():
            self.db.delete(slot)
        for appt in self.db.exec(
            select(Appointment).where(Appointment.persona_id == persona_id)
        ).all():
            self.db.delete(appt)
        for form in self.db.exec(
            select(Forms).where(Forms.persona_id == persona_id)
        ).all():
            self.db.delete(form)
        persona = self.db.get(Persona, persona_id)
        if persona is not None:
            self.db.delete(persona)
        self.db.commit()

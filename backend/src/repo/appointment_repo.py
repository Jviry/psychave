import uuid
from sqlmodel import Session, select
from models.appointment import Appointment, AppointmentStatus
from models.proposed_slot import ProposedSlot
from models.persona import Persona


class AppointmentRepo:
    def __init__(self, db: Session):
        self.db = db

    def create(self, persona_id: uuid.UUID, service_id: uuid.UUID, presenting_concern: str) -> Appointment:
        appt = Appointment(
            persona_id=persona_id,
            service_id=service_id,
            presenting_concern=presenting_concern,
            status=AppointmentStatus.PENDING,
        )
        self.db.add(appt)
        self.db.commit()
        self.db.refresh(appt)
        return appt

    def get_by_id(self, appointment_id: uuid.UUID) -> Appointment | None:
        return self.db.get(Appointment, appointment_id)

    def get_for_client(self, client_id: uuid.UUID, status: AppointmentStatus | None = None) -> list[Appointment]:
        statement = (
            select(Appointment)
            .join(Persona, Appointment.persona_id == Persona.persona_id)
            .where(Persona.client_id == client_id)
        )
        if status:
            statement = statement.where(Appointment.status == status)
        return self.db.exec(statement).all()

    def get_slots(self, appointment_id: uuid.UUID) -> list[ProposedSlot]:
        return self.db.exec(
            select(ProposedSlot).where(
                ProposedSlot.appointment_id == appointment_id)
        ).all()

    def get_slot_by_id(self, slot_id: uuid.UUID) -> ProposedSlot | None:
        return self.db.get(ProposedSlot, slot_id)

    def select_slot(self, appointment: Appointment, slot_id: uuid.UUID) -> Appointment:
        appointment.selected_slot_id = slot_id
        appointment.status = AppointmentStatus.AWAITING_PAYMENT
        self.db.add(appointment)
        self.db.commit()
        self.db.refresh(appointment)
        return appointment

    def cancel(self, appointment: Appointment) -> Appointment:
        appointment.status = AppointmentStatus.CANCELLED
        self.db.add(appointment)
        self.db.commit()
        self.db.refresh(appointment)
        return appointment

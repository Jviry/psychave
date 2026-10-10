import uuid
from common.exceptions import NotFoundError, BadRequestError
from sqlmodel import Session

from repo.appointment_repo import AppointmentRepo
from models.persona import Persona
from models.service import Service
from models.appointment import Appointment, AppointmentStatus
from schemas.appointment import AppointmentCreate


class AppointmentUsecase:
    def __init__(self, db: Session):
        self.db = db
        self.repo = AppointmentRepo(db)

    def _get_owned_persona(self, persona_id: uuid.UUID, client_id: uuid.UUID) -> Persona:
        persona = self.db.get(Persona, persona_id)
        if persona is None or persona.client_id != client_id:
            raise NotFoundError("Persona not found")
        return persona

    def _get_owned_appointment(self, appointment_id: uuid.UUID, client_id: uuid.UUID) -> Appointment:
        appt = self.repo.get_by_id(appointment_id)
        if appt is None:
            raise NotFoundError("Appointment not found")
        persona = self.db.get(Persona, appt.persona_id)
        if persona is None or persona.client_id != client_id:
            raise NotFoundError("Appointment not found")
        return appt

    def create_appointment(self, payload: AppointmentCreate, client_id: uuid.UUID) -> Appointment:
        self._get_owned_persona(payload.persona_id, client_id)

        service = self.db.get(Service, payload.service_id)
        if service is None or not service.is_active:
            raise BadRequestError("Service not available")

        return self.repo.create(payload.persona_id, payload.service_id, payload.presenting_concern)

    def list_appointments(self, client_id: uuid.UUID, status: AppointmentStatus | None = None) -> list[Appointment]:
        return self.repo.get_for_client(client_id, status)

    def get_appointment(self, appointment_id: uuid.UUID, client_id: uuid.UUID) -> Appointment:
        return self._get_owned_appointment(appointment_id, client_id)

    def get_slots(self, appointment_id: uuid.UUID, client_id: uuid.UUID):
        appt = self._get_owned_appointment(appointment_id, client_id)
        if appt.status not in (AppointmentStatus.AWAITING_SLOT_SELECTION, AppointmentStatus.AWAITING_PAYMENT):
            raise BadRequestError("No slots available yet")
        return self.repo.get_slots(appointment_id)

    def select_slot(self, appointment_id: uuid.UUID, slot_id: uuid.UUID, client_id: uuid.UUID) -> Appointment:
        appt = self._get_owned_appointment(appointment_id, client_id)

        if appt.status != AppointmentStatus.AWAITING_SLOT_SELECTION:
            raise BadRequestError("Appointment is not awaiting slot selection")

        slot = self.repo.get_slot_by_id(slot_id)
        if slot is None or slot.appointment_id != appointment_id:
            raise BadRequestError("Invalid slot")

        return self.repo.select_slot(appt, slot_id)

    def cancel_appointment(self, appointment_id: uuid.UUID, client_id: uuid.UUID) -> Appointment:
        appt = self._get_owned_appointment(appointment_id, client_id)
        if appt.status not in (AppointmentStatus.PENDING, AppointmentStatus.AWAITING_SLOT_SELECTION, AppointmentStatus.AWAITING_PAYMENT):
            raise BadRequestError("Appointment can no longer be canceled")
        return self.repo.cancel(appt)

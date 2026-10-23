import uuid
from common.exceptions import NotFoundError, BadRequestError
from sqlmodel import Session

from repo.appointment_repo import AppointmentRepo
from models.persona import Persona
from models.service import Service
from models.appointment import Appointment, AppointmentStatus
from schemas.appointment import AppointmentCreate, AppointmentRead
from usecase.appointment_view import build_appointment_read, build_appointment_reads


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

    def create_appointment(self, payload: AppointmentCreate, client_id: uuid.UUID) -> AppointmentRead:
        self._get_owned_persona(payload.persona_id, client_id)

        service = self.db.get(Service, payload.service_id)
        if service is None or not service.is_active:
            raise BadRequestError("Service not available")

        appointment = self.repo.create(
            payload.persona_id, payload.service_id, payload.presenting_concern
        )
        return build_appointment_read(self.db, appointment)

    def list_appointments(self, client_id: uuid.UUID, status: AppointmentStatus | None = None) -> list[AppointmentRead]:
        return build_appointment_reads(self.db, self.repo.get_for_client(client_id, status))

    def get_appointment(self, appointment_id: uuid.UUID, client_id: uuid.UUID) -> AppointmentRead:
        return build_appointment_read(self.db, self._get_owned_appointment(appointment_id, client_id))

    def get_slots(self, appointment_id: uuid.UUID, client_id: uuid.UUID):
        appt = self._get_owned_appointment(appointment_id, client_id)
        if appt.status not in (AppointmentStatus.AWAITING_SLOT_SELECTION, AppointmentStatus.AWAITING_PAYMENT):
            raise BadRequestError("No slots available yet")
        return self.repo.get_slots(appointment_id)

    def select_slot(self, appointment_id: uuid.UUID, slot_id: uuid.UUID, client_id: uuid.UUID) -> AppointmentRead:
        appt = self._get_owned_appointment(appointment_id, client_id)

        # Idempotent retry: the slot was already selected and the client is
        # retrying payment after a pending/failed attempt. Do not reject it.
        if (
            appt.status == AppointmentStatus.AWAITING_PAYMENT
            and appt.selected_slot_id == slot_id
        ):
            return build_appointment_read(self.db, appt)

        if appt.status != AppointmentStatus.AWAITING_SLOT_SELECTION:
            raise BadRequestError("Appointment is not awaiting slot selection")

        slot = self.repo.get_slot_by_id(slot_id)
        if slot is None or slot.appointment_id != appointment_id:
            raise BadRequestError("Invalid slot")

        updated = self.repo.select_slot(appt, slot_id)
        return build_appointment_read(self.db, updated)

    def cancel_appointment(self, appointment_id: uuid.UUID, client_id: uuid.UUID) -> AppointmentRead:
        appt = self._get_owned_appointment(appointment_id, client_id)
        if appt.status not in (AppointmentStatus.PENDING, AppointmentStatus.AWAITING_SLOT_SELECTION, AppointmentStatus.AWAITING_PAYMENT):
            raise BadRequestError("Appointment can no longer be canceled")
        return build_appointment_read(self.db, self.repo.cancel(appt))

import uuid

from sqlmodel import Session

from common.exceptions import BadRequestError, NotFoundError
from common.time import now_manila, payment_deadline_for, slot_start
from models.appointment import Appointment, AppointmentStatus, SchedulingTurn
from models.profile import Profile
from models.proposed_slot import ProposedSlot, SlotProposer, SlotStatus
from repo.appointment_repo import AppointmentRepo
from repo.profile_repo import ProfileRepo
from repo.service_repo import ServiceRepo
from schemas.appointment import (
    AppointmentCreate,
    AppointmentRead,
    PreferredSlotsUpdate,
    ProposedSlotRead,
)
from dependencies.email import get_email_service
from services.email.base import BaseEmailService
from utils.scheduling import validate_slot_inputs


class AppointmentUsecase:
    def __init__(self, db: Session, email_service: BaseEmailService | None = None):
        self.db = db
        self.repo = AppointmentRepo(db)
        self.profile_repo = ProfileRepo(db)
        self.service_repo = ServiceRepo(db)
        self.email_service = email_service or get_email_service()

    def _get_owned_profile(self, profile_id: uuid.UUID, client_id: uuid.UUID) -> Profile:
        profile = self.profile_repo.get_by_id(profile_id)
        if profile is None or profile.client_id != client_id:
            raise NotFoundError("Profile not found")
        return profile

    def _get_owned_appointment(self, appointment_id: uuid.UUID, client_id: uuid.UUID) -> Appointment:
        appt = self.repo.get_by_id(appointment_id)
        if appt is None:
            raise NotFoundError("Appointment not found")
        profile = self.profile_repo.get_by_id(appt.profile_id)
        if profile is None or profile.client_id != client_id:
            raise NotFoundError("Appointment not found")
        self.repo.expire_if_overdue(appt)
        return appt

    def create_appointment(self, payload: AppointmentCreate, client_id: uuid.UUID) -> AppointmentRead:
        self._get_owned_profile(payload.profile_id, client_id)

        service = self.service_repo.get_by_id(payload.service_id)
        if service is None or not service.is_active:
            raise BadRequestError("Service not available")

        slot_rows = validate_slot_inputs(payload.preferred_slots, service.duration_minutes)
        appointment = self.repo.create(
            payload.profile_id,
            payload.service_id,
            payload.presenting_concern,
            slot_rows,
        )
        client_email = self.repo.get_client_email(appointment)
        if client_email:
            self.email_service.send_booking_received(
                client_email,
                str(appointment.appointment_id),
                slot_rows,
            )
        return self.repo.build_read(appointment)

    def list_appointments(self, client_id: uuid.UUID, status: AppointmentStatus | None = None) -> list[AppointmentRead]:
        self.repo.expire_overdue_for_client(client_id)
        appointments = self.repo.get_for_client(client_id, status)
        return self.repo.build_reads(appointments)

    def get_appointment(self, appointment_id: uuid.UUID, client_id: uuid.UUID) -> AppointmentRead:
        return self.repo.build_read(self._get_owned_appointment(appointment_id, client_id))

    def get_slots(self, appointment_id: uuid.UUID, client_id: uuid.UUID) -> list[ProposedSlotRead]:
        appt = self._get_owned_appointment(appointment_id, client_id)
        if appt.status not in (
            AppointmentStatus.AWAITING_SCHEDULE,
            AppointmentStatus.AWAITING_PAYMENT,
        ):
            raise BadRequestError("No schedules available yet")
        return self.repo.build_read(appt).proposed_slots

    def _get_current_slot(
        self,
        appointment: Appointment,
        slot_id: uuid.UUID,
        expected_proposer: SlotProposer,
    ) -> ProposedSlot:
        slot = self.repo.get_slot_by_id(slot_id)
        if (
            slot is None
            or slot.appointment_id != appointment.appointment_id
            or slot.round != appointment.scheduling_round
            or slot.proposed_by != expected_proposer
            or slot.status != SlotStatus.PROPOSED
        ):
            raise BadRequestError("Invalid or no longer available schedule")
        return slot

    def accept_counter_slot(self, appointment_id: uuid.UUID, slot_id: uuid.UUID, client_id: uuid.UUID) -> AppointmentRead:
        appt = self._get_owned_appointment(appointment_id, client_id)

        if (
            appt.status != AppointmentStatus.AWAITING_SCHEDULE
            or appt.scheduling_turn != SchedulingTurn.CLIENT
        ):
            raise BadRequestError("Appointment is not awaiting your schedule confirmation")

        slot = self._get_current_slot(appt, slot_id, SlotProposer.PSYCHOLOGIST)
        session_start = slot_start(slot.session_date, slot.start_time)
        if session_start <= now_manila():
            raise BadRequestError("This schedule is no longer in the future")

        updated = self.repo.accept_slot(
            appt, slot, payment_deadline_for(session_start)
        )
        client_email = self.repo.get_client_email(updated)
        if client_email and updated.price is not None:
            self.email_service.send_schedule_accepted(
                client_email,
                str(updated.appointment_id),
                (slot.session_date, slot.start_time, slot.end_time),
                updated.price,
            )
        return self.repo.build_read(updated)

    def replace_preferences(
        self,
        appointment_id: uuid.UUID,
        payload: PreferredSlotsUpdate,
        client_id: uuid.UUID,
    ) -> AppointmentRead:
        appt = self._get_owned_appointment(appointment_id, client_id)

        if (
            appt.status != AppointmentStatus.AWAITING_SCHEDULE
            or appt.scheduling_turn != SchedulingTurn.CLIENT
        ):
            raise BadRequestError("Appointment is not awaiting new preferred schedules")

        service = self.service_repo.get_by_id(appt.service_id)
        if service is None:
            raise NotFoundError("Service not found")

        slot_rows = validate_slot_inputs(payload.slots, service.duration_minutes)
        updated = self.repo.replace_preferences(appt, slot_rows)
        psych_email = self.repo.get_psychologist_email(updated)
        if psych_email:
            self.email_service.send_preferences_updated(
                psych_email,
                str(updated.appointment_id),
                slot_rows,
            )
        return self.repo.build_read(updated)

    def cancel_appointment(self, appointment_id: uuid.UUID, client_id: uuid.UUID) -> AppointmentRead:
        appt = self._get_owned_appointment(appointment_id, client_id)
        if appt.status not in (
            AppointmentStatus.PENDING,
            AppointmentStatus.AWAITING_SCHEDULE,
            AppointmentStatus.AWAITING_PAYMENT,
        ):
            raise BadRequestError("Appointment can no longer be canceled")
        return self.repo.build_read(self.repo.cancel(appt))

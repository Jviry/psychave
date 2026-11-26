import uuid
from datetime import timedelta

from sqlmodel import Session

from common.exceptions import BadRequestError, ConflictError, NotFoundError
from common.time import now_manila, payment_deadline_for, slot_start
from models.appointment import Appointment, AppointmentStatus, SchedulingTurn
from models.profile import Profile
from models.proposed_slot import ProposedSlot, SlotProposer, SlotStatus
from models.user import UserRole
from repo.appointment_repo import AppointmentRepo
from repo.consent_template_repo import ConsentTemplateRepo
from repo.payment_repo import PaymentRepo
from repo.profile_repo import ProfileRepo
from repo.service_repo import ServiceRepo
from schemas.appointment import (
    AppointmentCreate,
    AppointmentRead,
    PreferredSlotsUpdate,
    ProposedSlotRead,
)
from schemas.consent_template import extract_major_version
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

        latest_form = self.profile_repo.get_latest_form(payload.profile_id)
        active_template = ConsentTemplateRepo(self.db).get_active()
        if latest_form is None:
            raise ConflictError(
                "Consent form is missing — please sign the consent form before booking"
            )
        if (
            active_template is not None
            and extract_major_version(latest_form.consent_version)
            != extract_major_version(active_template.consent_version)
        ):
            raise ConflictError(
                f"Consent form is outdated — please re-sign version {active_template.consent_version} before booking"
            )

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

        already_paid = PaymentRepo(self.db).has_paid_session(appt.appointment_id)
        updated = self.repo.accept_slot(
            appt,
            slot,
            None if already_paid else payment_deadline_for(session_start),
            already_paid=already_paid,
        )
        client_email = self.repo.get_client_email(updated)
        if already_paid:
            if client_email:
                self.email_service.send_payment_confirmed(
                    client_email, str(updated.appointment_id), "client"
                )
            psych_email = self.repo.get_psychologist_email(updated)
            if psych_email:
                self.email_service.send_payment_confirmed(
                    psych_email, str(updated.appointment_id), "psychologist"
                )
        elif client_email and updated.price is not None:
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
        if PaymentRepo(self.db).has_paid_session(appt.appointment_id):
            raise BadRequestError(
                "Paid appointments cannot be cancelled directly; please contact support for a refund"
            )
        if appt.status not in (
            AppointmentStatus.PENDING,
            AppointmentStatus.AWAITING_SCHEDULE,
            AppointmentStatus.AWAITING_PAYMENT,
        ):
            raise BadRequestError("Appointment can no longer be canceled")
        return self.repo.build_read(self.repo.cancel(appt))

    def request_reschedule(
        self,
        appointment_id: uuid.UUID,
        actor_id: uuid.UUID,
        actor_role: UserRole,
        reason: str | None = None,
    ) -> AppointmentRead:
        if actor_role == UserRole.PSYCHOLOGIST:
            appt = self.repo.get_by_id(appointment_id)
            if appt is None or appt.psychologist_id != actor_id:
                raise NotFoundError("Appointment not found")
            requested_by = "psychologist"
            counterparty_turn = SchedulingTurn.CLIENT
        else:
            appt = self._get_owned_appointment(appointment_id, actor_id)
            requested_by = "client"
            counterparty_turn = SchedulingTurn.PSYCHOLOGIST

        if appt.status != AppointmentStatus.CONFIRMED:
            raise BadRequestError("Only confirmed appointments can be rescheduled")

        is_free = requested_by == "psychologist"
        if not is_free:
            slot = (
                self.repo.get_slot_by_id(appt.selected_slot_id)
                if appt.selected_slot_id is not None
                else None
            )
            if slot is None:
                is_free = True
            else:
                start_dt = slot_start(slot.session_date, slot.start_time)
                is_free = (start_dt - now_manila()) >= timedelta(hours=2)

        cleaned_reason = reason.strip() if isinstance(reason, str) and reason.strip() else None
        if is_free:
            updated = self.repo.start_reschedule_negotiation(
                appt,
                turn=counterparty_turn,
                requested_by=requested_by,
                reason=cleaned_reason,
                waived=False,
            )
        else:
            updated = self.repo.request_paid_reschedule(
                appt,
                requested_by=requested_by,
                reason=cleaned_reason,
            )
        return self.repo.build_read(updated)

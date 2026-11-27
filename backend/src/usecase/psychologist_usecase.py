import uuid

from sqlmodel import Session

from common.exceptions import (
    BadRequestError,
    ConflictError,
    NotFoundError,
    ValidationError,
)
from common.time import now_manila, payment_deadline_for, slot_start
from models.appointment import Appointment, AppointmentStatus, SchedulingTurn
from models.proposed_slot import ProposedSlot, SlotProposer, SlotStatus
from models.psychologist_profile import PsychologistProfile
from repo.appointment_repo import AppointmentRepo
from repo.payment_repo import PaymentRepo
from repo.psychologist_repo import PsychologistRepo
from repo.service_repo import ServiceRepo
from schemas.appointment import (
    AppointmentRead,
    PendingAppointmentRead,
    SlotInput,
)
from dependencies.email import get_email_service
from schemas.psychologist import PickupRequest, PsychologistProfileUpdate
from services.email.base import BaseEmailService
from utils.scheduling import (
    interval_for,
    intervals_overlap,
    slot_interval,
    validate_single_slot,
)


class PsychologistUsecase:
    def __init__(self, db: Session, email_service: BaseEmailService | None = None):
        self.db = db
        self.repo = PsychologistRepo(db)
        self.appointment_repo = AppointmentRepo(db)
        self.service_repo = ServiceRepo(db)
        self.email_service = email_service or get_email_service()

    # ----- pending requests / pickup -----

    def _compute_conflicts_for_read(
        self,
        read: AppointmentRead,
        blocking_intervals: list[tuple],
    ) -> list[uuid.UUID]:
        duration = read.service_duration_minutes or 60
        conflicts: list[uuid.UUID] = []
        for slot in read.proposed_slots:
            if (
                slot.round != read.scheduling_round
                or slot.status != SlotStatus.PROPOSED
                or slot.proposed_by != SlotProposer.CLIENT
            ):
                continue
            start, end = interval_for(
                slot.session_date,
                slot.start_time,
                slot.end_time,
                duration,
            )
            if any(
                intervals_overlap(start, end, block_start, block_end)
                for block_start, block_end in blocking_intervals
            ):
                conflicts.append(slot.slot_id)
        return conflicts

    def list_pending(self, psychologist_id: uuid.UUID) -> list[PendingAppointmentRead]:
        blocking_intervals = [
            slot_interval(slot, duration)
            for slot, duration in self.repo.get_blocking_slots(psychologist_id)
        ]

        reads = self.appointment_repo.build_reads(self.repo.get_pending())
        result: list[PendingAppointmentRead] = []
        for read in reads:
            conflicts = self._compute_conflicts_for_read(read, blocking_intervals)
            data = read.model_dump()
            data["conflicting_slot_ids"] = conflicts
            result.append(PendingAppointmentRead(**data))
        return result

    def _get_owned_appointment(self, appointment_id: uuid.UUID, psychologist_id: uuid.UUID) -> Appointment:
        appt = self.repo.get_for_psychologist(appointment_id, psychologist_id)
        if appt is None:
            raise NotFoundError("Appointment not found")
        self.appointment_repo.expire_if_overdue(appt)
        return appt

    def _get_service_duration(self, appointment: Appointment) -> int:
        service = self.service_repo.get_by_id(appointment.service_id)
        if service is None:
            raise NotFoundError("Service not found")
        return service.duration_minutes

    def _has_conflict(
        self,
        psychologist_id: uuid.UUID,
        session_date,
        start_time,
        end_time,
        duration_minutes: int,
    ) -> bool:
        start = slot_start(session_date, start_time)
        end = interval_for(session_date, start_time, end_time, duration_minutes)[1]
        for slot, duration in self.repo.get_blocking_slots(psychologist_id):
            block_start, block_end = slot_interval(slot, duration)
            if intervals_overlap(start, end, block_start, block_end):
                return True
        return False

    def pickup(
        self,
        appointment_id: uuid.UUID,
        psychologist_id: uuid.UUID,
        payload: PickupRequest,
    ) -> AppointmentRead:
        profile = self.repo.get_profile(psychologist_id)
        if profile is None or not profile.social_media_links:
            raise ValidationError(
                "Add at least one social media link to your profile before accepting booking requests"
            )

        if payload.price <= 0:
            raise ValidationError("Price must be greater than zero")

        if (payload.slot_id is None) == (payload.counter_slot is None):
            raise ValidationError(
                "Choose one preferred schedule or offer one alternative schedule"
            )

        appt = self.repo.get_by_id(appointment_id)
        if appt is None:
            raise NotFoundError("Appointment not found")
        if appt.psychologist_id is not None:
            raise ConflictError("Appointment has already been picked up")
        if appt.status != AppointmentStatus.PENDING:
            raise BadRequestError("Appointment is no longer pending")

        duration = self._get_service_duration(appt)

        if payload.slot_id is not None:
            slot = self._get_current_slot(appt, payload.slot_id, SlotProposer.CLIENT)
            session_start = slot_start(slot.session_date, slot.start_time)
            if session_start <= now_manila():
                raise BadRequestError("This schedule is no longer in the future")

            self.repo.lock_psychologist(psychologist_id)
            if self._has_conflict(
                psychologist_id,
                slot.session_date,
                slot.start_time,
                slot.end_time,
                duration,
            ):
                raise ConflictError(
                    "You already have a session at this time; offer an alternative schedule"
                )

            picked_up = self.repo.pickup_and_accept_slot(
                appointment_id,
                psychologist_id,
                payload.price,
                slot,
                payment_deadline_for(session_start),
            )
            notify_slot = (slot.session_date, slot.start_time, slot.end_time)
            accepted = True
        else:
            assert payload.counter_slot is not None
            session_date, start_time, end_time = validate_single_slot(
                payload.counter_slot, duration
            )
            if self._has_conflict(
                psychologist_id, session_date, start_time, end_time, duration
            ):
                raise ConflictError("You already have a session at this time")

            picked_up = self.repo.pickup_and_counter_offer(
                appointment_id,
                psychologist_id,
                payload.price,
                appt.scheduling_round,
                session_date,
                start_time,
                end_time,
            )
            notify_slot = (session_date, start_time, end_time)
            accepted = False

        if picked_up is None:
            raise ConflictError("Appointment has already been picked up")

        client_email = self.appointment_repo.get_client_email(picked_up)
        if client_email:
            if accepted:
                self.email_service.send_schedule_accepted(
                    client_email,
                    str(picked_up.appointment_id),
                    notify_slot,
                    payload.price,
                )
            else:
                self.email_service.send_counter_offer(
                    client_email,
                    str(picked_up.appointment_id),
                    notify_slot,
                    payload.price,
                )
        return self.appointment_repo.build_read(picked_up)

    # ----- schedule negotiation -----

    def _get_current_slot(
        self,
        appointment: Appointment,
        slot_id: uuid.UUID,
        expected_proposer: SlotProposer,
    ) -> ProposedSlot:
        slot = self.appointment_repo.get_slot_by_id(slot_id)
        if (
            slot is None
            or slot.appointment_id != appointment.appointment_id
            or slot.round != appointment.scheduling_round
            or slot.proposed_by != expected_proposer
            or slot.status != SlotStatus.PROPOSED
        ):
            raise BadRequestError("Invalid or no longer available schedule")
        return slot

    def accept_preferred_slot(
        self,
        appointment_id: uuid.UUID,
        slot_id: uuid.UUID,
        psychologist_id: uuid.UUID,
    ) -> AppointmentRead:
        appt = self._get_owned_appointment(appointment_id, psychologist_id)

        if (
            appt.status != AppointmentStatus.AWAITING_SCHEDULE
            or appt.scheduling_turn != SchedulingTurn.PSYCHOLOGIST
        ):
            raise BadRequestError("Appointment is not awaiting your schedule review")

        slot = self._get_current_slot(appt, slot_id, SlotProposer.CLIENT)
        session_start = slot_start(slot.session_date, slot.start_time)
        if session_start <= now_manila():
            raise BadRequestError("This schedule is no longer in the future")

        duration = self._get_service_duration(appt)
        self.repo.lock_psychologist(psychologist_id)
        if self._has_conflict(
            psychologist_id,
            slot.session_date,
            slot.start_time,
            slot.end_time,
            duration,
        ):
            raise ConflictError(
                "You already have a session at this time; offer an alternative schedule"
            )

        already_paid = PaymentRepo(self.db).has_paid_session(appt.appointment_id)
        updated = self.repo.accept_slot(
            appt,
            slot,
            None if already_paid else payment_deadline_for(session_start),
            already_paid=already_paid,
        )
        client_email = self.appointment_repo.get_client_email(updated)
        if already_paid:
            if client_email:
                self.email_service.send_payment_confirmed(
                    client_email, str(updated.appointment_id), "client"
                )
            psych_email = self.appointment_repo.get_psychologist_email(updated)
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
        return self.appointment_repo.build_read(updated)

    def counter_offer(
        self,
        appointment_id: uuid.UUID,
        payload: SlotInput,
        psychologist_id: uuid.UUID,
    ) -> AppointmentRead:
        appt = self._get_owned_appointment(appointment_id, psychologist_id)

        if (
            appt.status != AppointmentStatus.AWAITING_SCHEDULE
            or appt.scheduling_turn != SchedulingTurn.PSYCHOLOGIST
        ):
            raise BadRequestError("Appointment is not awaiting your schedule review")

        duration = self._get_service_duration(appt)
        session_date, start_time, end_time = validate_single_slot(payload, duration)

        if self._has_conflict(
            psychologist_id, session_date, start_time, end_time, duration
        ):
            raise ConflictError("You already have a session at this time")

        updated = self.repo.counter_offer(
            appt, session_date, start_time, end_time
        )
        client_email = self.appointment_repo.get_client_email(updated)
        if client_email and updated.price is not None:
            self.email_service.send_counter_offer(
                client_email,
                str(updated.appointment_id),
                (session_date, start_time, end_time),
                updated.price,
            )
        return self.appointment_repo.build_read(updated)

    # ----- own schedule -----

    def list_mine(self, psychologist_id: uuid.UUID, status: AppointmentStatus | None = None) -> list[AppointmentRead]:
        self.appointment_repo.expire_overdue_for_psychologist(psychologist_id)
        appointments = self.repo.list_for_psychologist(psychologist_id, status)
        reads = self.appointment_repo.build_reads(appointments, include_internal=True)
        needs_conflict_check = any(
            r.status == AppointmentStatus.AWAITING_SCHEDULE
            and r.scheduling_turn == SchedulingTurn.PSYCHOLOGIST
            for r in reads
        )
        if needs_conflict_check:
            blocking_intervals = [
                slot_interval(slot, duration)
                for slot, duration in self.repo.get_blocking_slots(psychologist_id)
            ]
            for read in reads:
                if (
                    read.status == AppointmentStatus.AWAITING_SCHEDULE
                    and read.scheduling_turn == SchedulingTurn.PSYCHOLOGIST
                ):
                    read.conflicting_slot_ids = self._compute_conflicts_for_read(
                        read, blocking_intervals
                    )
        return reads

    def get_detail(self, appointment_id: uuid.UUID, psychologist_id: uuid.UUID) -> AppointmentRead:
        read = self.appointment_repo.build_read(
            self._get_owned_appointment(appointment_id, psychologist_id),
            include_internal=True,
        )
        if (
            read.status == AppointmentStatus.AWAITING_SCHEDULE
            and read.scheduling_turn == SchedulingTurn.PSYCHOLOGIST
        ):
            blocking_intervals = [
                slot_interval(slot, duration)
                for slot, duration in self.repo.get_blocking_slots(psychologist_id)
            ]
            read.conflicting_slot_ids = self._compute_conflicts_for_read(
                read, blocking_intervals
            )
        return read

    def complete_appointment(self, appointment_id: uuid.UUID, psychologist_id: uuid.UUID) -> AppointmentRead:
        appt = self._get_owned_appointment(appointment_id, psychologist_id)
        if appt.status != AppointmentStatus.CONFIRMED:
            raise BadRequestError("Only confirmed appointments can be marked as completed")
        completed = self.repo.complete(appt)
        client_email = self.appointment_repo.get_client_email(completed)
        if client_email:
            from repo.cms_repo import CmsRepo

            eval_url = CmsRepo(self.db).get_or_seed_content().evaluation_form_url
            if eval_url:
                self.email_service.send_evaluation_request(
                    client_email,
                    str(completed.appointment_id),
                    evaluation_form_url=eval_url,
                )
        return self.appointment_repo.build_read(completed)

    def update_meeting_link(
        self,
        appointment_id: uuid.UUID,
        psychologist_id: uuid.UUID,
        meeting_link: str,
    ) -> AppointmentRead:
        appt = self._get_owned_appointment(appointment_id, psychologist_id)
        if appt.status != AppointmentStatus.CONFIRMED:
            raise BadRequestError(
                "Meeting link can only be set on confirmed appointments"
            )
        appt.meeting_link = meeting_link
        self.db.add(appt)
        self.db.commit()
        self.db.refresh(appt)

        client_email = self.appointment_repo.get_client_email(appt)
        if client_email:
            self.email_service.send_meeting_link_ready(
                client_email, str(appt.appointment_id), meeting_link
            )
        return self.appointment_repo.build_read(appt)

    def mark_no_show(self, appointment_id: uuid.UUID, psychologist_id: uuid.UUID) -> AppointmentRead:
        appt = self._get_owned_appointment(appointment_id, psychologist_id)
        if appt.status != AppointmentStatus.CONFIRMED:
            raise BadRequestError("Only confirmed appointments can be marked as no-show")
        if appt.selected_slot_id is not None:
            slot = self.appointment_repo.get_slot_by_id(appt.selected_slot_id)
            if slot is not None:
                start_dt = slot_start(slot.session_date, slot.start_time)
                if now_manila() < start_dt:
                    raise BadRequestError(
                        "Cannot mark no-show before the scheduled session start time"
                    )
        updated = self.appointment_repo.mark_no_show(appt)
        client_email = self.appointment_repo.get_client_email(updated)
        if client_email:
            self.email_service.send_no_show_marked(
                client_email, str(updated.appointment_id), "client"
            )
        psych_email = self.appointment_repo.get_psychologist_email(updated)
        if psych_email:
            self.email_service.send_no_show_marked(
                psych_email, str(updated.appointment_id), "psychologist"
            )
        return self.appointment_repo.build_read(updated, include_internal=True)

    def waive_reschedule_fee(
        self,
        appointment_id: uuid.UUID,
        psychologist_id: uuid.UUID,
        reason: str | None = None,
    ) -> AppointmentRead:
        appt = self._get_owned_appointment(appointment_id, psychologist_id)
        if appt.status not in (
            AppointmentStatus.RESCHEDULE_REQUESTED,
            AppointmentStatus.NO_SHOW,
        ):
            raise BadRequestError(
                "Only appointments awaiting a reschedule fee or marked no-show can have the fee waived"
            )
        cleaned_reason = (
            reason.strip() if isinstance(reason, str) and reason.strip() else None
        )
        updated = self.appointment_repo.waive_reschedule_fee(
            appt, reason=cleaned_reason
        )
        has_submitted_slots = updated.scheduling_turn == SchedulingTurn.PSYCHOLOGIST
        client_email = self.appointment_repo.get_client_email(updated)
        if client_email:
            self.email_service.send_reschedule_fee_resolved(
                client_email,
                str(updated.appointment_id),
                "client",
                waived=True,
                has_submitted_slots=has_submitted_slots,
            )
        psych_email = self.appointment_repo.get_psychologist_email(updated)
        if psych_email:
            self.email_service.send_reschedule_fee_resolved(
                psych_email,
                str(updated.appointment_id),
                "psychologist",
                waived=True,
                has_submitted_slots=has_submitted_slots,
                waiver_reason=cleaned_reason,
            )
        return self.appointment_repo.build_read(updated, include_internal=True)

    # ----- profile -----

    def update_profile(self, profile: PsychologistProfile, payload: PsychologistProfileUpdate) -> PsychologistProfile:
        data = payload.model_dump(exclude_unset=True, mode="json")
        return self.repo.update_profile(profile, data)

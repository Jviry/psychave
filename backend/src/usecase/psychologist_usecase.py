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
from repo.psychologist_repo import PsychologistRepo
from repo.service_repo import ServiceRepo
from schemas.appointment import (
    AppointmentRead,
    PendingAppointmentRead,
    SlotInput,
)
from schemas.psychologist import PickupRequest, PsychologistProfileUpdate
from utils.scheduling import (
    interval_for,
    intervals_overlap,
    slot_interval,
    validate_single_slot,
)


class PsychologistUsecase:
    def __init__(self, db: Session):
        self.db = db
        self.repo = PsychologistRepo(db)
        self.appointment_repo = AppointmentRepo(db)
        self.service_repo = ServiceRepo(db)

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

        if picked_up is None:
            raise ConflictError("Appointment has already been picked up")
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

        updated = self.repo.accept_slot(
            appt, slot, payment_deadline_for(session_start)
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
        return self.appointment_repo.build_read(updated)

    # ----- own schedule -----

    def list_mine(self, psychologist_id: uuid.UUID, status: AppointmentStatus | None = None) -> list[AppointmentRead]:
        appointments = self.repo.list_for_psychologist(psychologist_id, status)
        for appointment in appointments:
            self.appointment_repo.expire_if_overdue(appointment)
        reads = self.appointment_repo.build_reads(appointments)
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
            self._get_owned_appointment(appointment_id, psychologist_id)
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
        return self.appointment_repo.build_read(self.repo.complete(appt))

    # ----- profile -----

    def update_profile(self, profile: PsychologistProfile, payload: PsychologistProfileUpdate) -> PsychologistProfile:
        data = payload.model_dump(exclude_unset=True, mode="json")
        return self.repo.update_profile(profile, data)

import uuid
from datetime import datetime, timezone

from sqlmodel import Session

from common.exceptions import (
    BadRequestError,
    ConflictError,
    NotFoundError,
    ValidationError,
)
from models.appointment import Appointment, AppointmentStatus
from models.proposed_slot import ProposedSlot
from models.psychologist_profile import PsychologistProfile
from repo.psychologist_repo import PsychologistRepo
from schemas.psychologist import PsychologistProfileUpdate, SlotProposal

SLOTS_PER_APPOINTMENT = 3


class PsychologistUsecase:
    def __init__(self, db: Session):
        self.db = db
        self.repo = PsychologistRepo(db)

    # ----- pending requests / pickup -----

    def list_pending(self) -> list[Appointment]:
        return self.repo.get_pending()

    def _get_owned_appointment(self, appointment_id: uuid.UUID, psychologist_id: uuid.UUID) -> Appointment:
        appt = self.repo.get_for_psychologist(appointment_id, psychologist_id)
        if appt is None:
            raise NotFoundError("Appointment not found")
        return appt

    def pickup(self, appointment_id: uuid.UUID, psychologist_id: uuid.UUID, price: float) -> Appointment:
        appt = self.repo.get_by_id(appointment_id)
        if appt is None:
            raise NotFoundError("Appointment not found")
        if appt.psychologist_id is not None:
            raise ConflictError("Appointment has already been picked up")
        if appt.status != AppointmentStatus.PENDING:
            raise BadRequestError("Appointment is no longer pending")
        if price <= 0:
            raise ValidationError("Price must be greater than zero")
        return self.repo.pickup(appt, psychologist_id, price)

    # ----- slot proposal -----

    def propose_slots(self, appointment_id: uuid.UUID, psychologist_id: uuid.UUID, proposals: list[SlotProposal]) -> list[ProposedSlot]:
        appt = self._get_owned_appointment(appointment_id, psychologist_id)

        if appt.status != AppointmentStatus.AWAITING_SLOT_SELECTION:
            raise BadRequestError("Appointment is not awaiting slot selection")

        if len(proposals) != SLOTS_PER_APPOINTMENT:
            raise ValidationError(
                f"Exactly {SLOTS_PER_APPOINTMENT} slots must be proposed, got {len(proposals)}")

        if self.repo.get_slots(appointment_id):
            raise ConflictError(
                "Slots have already been proposed for this appointment")

        seen: set[tuple] = set()
        now = datetime.now(timezone.utc).replace(tzinfo=None)

        for p in proposals:
            key = (p.session_date, p.start_time)
            if key in seen:
                raise ValidationError(
                    "Proposed slots must not contain duplicates")
            seen.add(key)

            if p.end_time is not None and p.end_time <= p.start_time:
                raise ValidationError("Slot end time must be after start time")

            if datetime.combine(p.session_date, p.start_time) <= now:
                raise ValidationError("Proposed slots must be in the future")

        return self.repo.create_slots(appointment_id, proposals)

    # ----- own schedule -----

    def list_mine(self, psychologist_id: uuid.UUID, status: AppointmentStatus | None = None) -> list[Appointment]:
        return self.repo.list_for_psychologist(psychologist_id, status)

    def get_detail(self, appointment_id: uuid.UUID, psychologist_id: uuid.UUID) -> Appointment:
        return self._get_owned_appointment(appointment_id, psychologist_id)

    # ----- profile -----

    def update_profile(self, profile: PsychologistProfile, payload: PsychologistProfileUpdate) -> PsychologistProfile:
        data = payload.model_dump(exclude_unset=True)
        return self.repo.update_profile(profile, data)

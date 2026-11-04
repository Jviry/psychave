import uuid
from datetime import datetime

from sqlalchemy import and_, or_, update
from sqlmodel import Session, select

from common.time import now_manila
from models.appointment import Appointment, AppointmentStatus, SchedulingTurn
from models.psychologist_profile import PsychologistProfile
from models.proposed_slot import ProposedSlot, SlotProposer, SlotStatus
from models.service import Service
from repo.appointment_repo import AppointmentRepo
from schemas.psychologist import PsychologistProfileUpdate


class PsychologistRepo:
    def __init__(self, db: Session):
        self.db = db

    # ----- appointments -----

    def get_by_id(self, appointment_id: uuid.UUID) -> Appointment | None:
        return self.db.get(Appointment, appointment_id)

    def get_pending(self) -> list[Appointment]:
        return self.db.exec(
            select(Appointment).where(
                Appointment.psychologist_id.is_(None),
                Appointment.status == AppointmentStatus.PENDING,
            )
        ).all()

    def get_for_psychologist(self, appointment_id: uuid.UUID, psychologist_id: uuid.UUID) -> Appointment | None:
        return self.db.exec(
            select(Appointment).where(
                Appointment.appointment_id == appointment_id,
                Appointment.psychologist_id == psychologist_id,
            )
        ).first()

    def list_for_psychologist(self, psychologist_id: uuid.UUID, status: AppointmentStatus | None = None) -> list[Appointment]:
        statement = select(Appointment).where(
            Appointment.psychologist_id == psychologist_id
        )
        if status:
            statement = statement.where(Appointment.status == status)
        return self.db.exec(statement).all()

    def pickup_and_accept_slot(
        self,
        appointment_id: uuid.UUID,
        psychologist_id: uuid.UUID,
        price: float,
        slot: ProposedSlot,
        payment_deadline: datetime,
    ) -> Appointment | None:
        """Atomically claim a pending request and accept a client-preferred slot.

        Returns None (rolling back) when another psychologist won the race or the
        request is no longer pending.
        """
        result = self.db.execute(
            update(Appointment)
            .where(
                Appointment.appointment_id == appointment_id,
                Appointment.psychologist_id.is_(None),
                Appointment.status == AppointmentStatus.PENDING,
            )
            .values(
                psychologist_id=psychologist_id,
                price=price,
                selected_slot_id=slot.slot_id,
                status=AppointmentStatus.AWAITING_PAYMENT,
                scheduling_turn=None,
                payment_deadline=payment_deadline,
            )
        )
        if result.rowcount == 0:
            self.db.rollback()
            return None

        self.db.exec(
            update(ProposedSlot)
            .where(
                ProposedSlot.appointment_id == appointment_id,
                ProposedSlot.round == slot.round,
                ProposedSlot.status == SlotStatus.PROPOSED,
                ProposedSlot.slot_id != slot.slot_id,
            )
            .values(status=SlotStatus.DECLINED)
        )
        slot.status = SlotStatus.ACCEPTED
        self.db.add(slot)
        self.db.commit()

        appointment = self.db.get(Appointment, appointment_id)
        if appointment is not None:
            self.db.refresh(appointment)
        return appointment

    def pickup_and_counter_offer(
        self,
        appointment_id: uuid.UUID,
        psychologist_id: uuid.UUID,
        price: float,
        current_round: int,
        session_date,
        start_time,
        end_time,
    ) -> Appointment | None:
        """Atomically claim a pending request and propose a single alternative slot."""
        next_round = current_round + 1
        result = self.db.execute(
            update(Appointment)
            .where(
                Appointment.appointment_id == appointment_id,
                Appointment.psychologist_id.is_(None),
                Appointment.status == AppointmentStatus.PENDING,
            )
            .values(
                psychologist_id=psychologist_id,
                price=price,
                status=AppointmentStatus.AWAITING_SCHEDULE,
                scheduling_turn=SchedulingTurn.CLIENT,
                scheduling_round=next_round,
            )
        )
        if result.rowcount == 0:
            self.db.rollback()
            return None

        self.db.exec(
            update(ProposedSlot)
            .where(
                ProposedSlot.appointment_id == appointment_id,
                ProposedSlot.round == current_round,
                ProposedSlot.status == SlotStatus.PROPOSED,
            )
            .values(status=SlotStatus.DECLINED)
        )
        self.db.add(
            ProposedSlot(
                appointment_id=appointment_id,
                session_date=session_date,
                start_time=start_time,
                end_time=end_time,
                proposed_by=SlotProposer.PSYCHOLOGIST,
                status=SlotStatus.PROPOSED,
                round=next_round,
            )
        )
        self.db.commit()

        appointment = self.db.get(Appointment, appointment_id)
        if appointment is not None:
            self.db.refresh(appointment)
        return appointment

    def complete(self, appointment: Appointment) -> Appointment:
        appointment.status = AppointmentStatus.COMPLETED
        self.db.add(appointment)
        self.db.commit()
        self.db.refresh(appointment)
        return appointment

    # ----- slots -----

    def get_slots(self, appointment_id: uuid.UUID) -> list[ProposedSlot]:
        return self.db.exec(
            select(ProposedSlot).where(
                ProposedSlot.appointment_id == appointment_id)
        ).all()

    def accept_slot(
        self,
        appointment: Appointment,
        slot: ProposedSlot,
        payment_deadline: datetime,
    ) -> Appointment:
        return AppointmentRepo(self.db).accept_slot(
            appointment, slot, payment_deadline
        )

    def counter_offer(
        self,
        appointment: Appointment,
        session_date,
        start_time,
        end_time,
    ) -> Appointment:
        return AppointmentRepo(self.db).counter_offer(
            appointment, session_date, start_time, end_time
        )

    def get_blocking_slots(
        self, psychologist_id: uuid.UUID
    ) -> list[tuple[ProposedSlot, int]]:
        """Slots already held by this psychologist.

        Only agreed (awaiting payment) and confirmed sessions reserve a time.
        An awaiting-payment row whose deadline has passed is ignored so the
        psychologist is not blocked by a lapsed checkout.
        """
        now = now_manila()
        rows = self.db.exec(
            select(ProposedSlot, Service.duration_minutes)
            .join(
                Appointment,
                ProposedSlot.slot_id == Appointment.selected_slot_id,
            )
            .join(Service, Service.service_id == Appointment.service_id)
            .where(
                Appointment.psychologist_id == psychologist_id,
                or_(
                    Appointment.status == AppointmentStatus.CONFIRMED,
                    and_(
                        Appointment.status == AppointmentStatus.AWAITING_PAYMENT,
                        or_(
                            Appointment.payment_deadline.is_(None),
                            Appointment.payment_deadline > now,
                        ),
                    ),
                ),
            )
        ).all()
        return [(slot, duration) for slot, duration in rows]

    # ----- profile -----

    def get_profile(self, psychologist_id: uuid.UUID) -> PsychologistProfile | None:
        return self.db.get(PsychologistProfile, psychologist_id)

    def update_profile(self, profile: PsychologistProfile, data: dict) -> PsychologistProfile:
        for field, value in data.items():
            setattr(profile, field, value)
        self.db.add(profile)
        self.db.commit()
        self.db.refresh(profile)
        return profile

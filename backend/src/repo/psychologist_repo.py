import uuid
from sqlmodel import Session, select

from models.appointment import Appointment, AppointmentStatus
from models.proposed_slot import ProposedSlot
from models.psychologist_profile import PsychologistProfile
from schemas.psychologist import SlotProposal


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

    def pickup(self, appointment: Appointment, psychologist_id: uuid.UUID, price: float) -> Appointment:
        appointment.psychologist_id = psychologist_id
        appointment.price = price
        appointment.status = AppointmentStatus.AWAITING_SLOT_SELECTION
        self.db.add(appointment)
        self.db.commit()
        self.db.refresh(appointment)
        return appointment

    # ----- proposed slots -----

    def get_slots(self, appointment_id: uuid.UUID) -> list[ProposedSlot]:
        return self.db.exec(
            select(ProposedSlot).where(
                ProposedSlot.appointment_id == appointment_id)
        ).all()

    def create_slots(self, appointment_id: uuid.UUID, proposals: list[SlotProposal]) -> list[ProposedSlot]:
        slots = [
            ProposedSlot(
                appointment_id=appointment_id,
                session_date=p.session_date,
                start_time=p.start_time,
                end_time=p.end_time,
            )
            for p in proposals
        ]
        for slot in slots:
            self.db.add(slot)
        self.db.commit()
        for slot in slots:
            self.db.refresh(slot)
        return slots

    # ----- profile -----

    def update_profile(self, profile: PsychologistProfile, data: dict) -> PsychologistProfile:
        for field, value in data.items():
            setattr(profile, field, value)
        self.db.add(profile)
        self.db.commit()
        self.db.refresh(profile)
        return profile

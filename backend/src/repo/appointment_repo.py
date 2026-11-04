import uuid
from datetime import datetime, timezone

from sqlalchemy import update
from sqlmodel import Session, select

from common.time import now_manila
from models.appointment import Appointment, AppointmentStatus, SchedulingTurn
from models.persona import Persona
from models.proposed_slot import ProposedSlot, SlotProposer, SlotStatus
from models.psychologist_profile import PsychologistProfile
from models.service import Service
from schemas.appointment import AppointmentRead, ProposedSlotRead
from schemas.psychologist import SocialMediaLink


class AppointmentRepo:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        persona_id: uuid.UUID,
        service_id: uuid.UUID,
        presenting_concern: str,
        slot_rows: list[tuple],
    ) -> Appointment:
        appt = Appointment(
            persona_id=persona_id,
            service_id=service_id,
            presenting_concern=presenting_concern,
            requested_datetime=datetime.now(timezone.utc).replace(tzinfo=None),
            status=AppointmentStatus.PENDING,
            scheduling_turn=None,
            scheduling_round=1,
        )
        self.db.add(appt)
        self.db.flush()

        for session_date, start_time, end_time in slot_rows:
            self.db.add(
                ProposedSlot(
                    appointment_id=appt.appointment_id,
                    session_date=session_date,
                    start_time=start_time,
                    end_time=end_time,
                    proposed_by=SlotProposer.CLIENT,
                    status=SlotStatus.PROPOSED,
                    round=1,
                )
            )

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

    def get_current_round_slots(self, appointment_id: uuid.UUID, round_number: int) -> list[ProposedSlot]:
        return self.db.exec(
            select(ProposedSlot).where(
                ProposedSlot.appointment_id == appointment_id,
                ProposedSlot.round == round_number,
            )
        ).all()

    def _decline_round(self, appointment_id: uuid.UUID, round_number: int) -> None:
        self.db.exec(
            update(ProposedSlot)
            .where(
                ProposedSlot.appointment_id == appointment_id,
                ProposedSlot.round == round_number,
                ProposedSlot.status == SlotStatus.PROPOSED,
            )
            .values(status=SlotStatus.DECLINED)
        )

    def accept_slot(
        self,
        appointment: Appointment,
        slot: ProposedSlot,
        payment_deadline: datetime,
    ) -> Appointment:
        self.db.exec(
            update(ProposedSlot)
            .where(
                ProposedSlot.appointment_id == appointment.appointment_id,
                ProposedSlot.round == slot.round,
                ProposedSlot.status == SlotStatus.PROPOSED,
                ProposedSlot.slot_id != slot.slot_id,
            )
            .values(status=SlotStatus.DECLINED)
        )

        slot.status = SlotStatus.ACCEPTED
        self.db.add(slot)

        appointment.selected_slot_id = slot.slot_id
        appointment.status = AppointmentStatus.AWAITING_PAYMENT
        appointment.scheduling_turn = None
        appointment.payment_deadline = payment_deadline
        self.db.add(appointment)
        self.db.commit()
        self.db.refresh(appointment)
        return appointment

    def counter_offer(
        self,
        appointment: Appointment,
        session_date,
        start_time,
        end_time,
    ) -> Appointment:
        self._decline_round(appointment.appointment_id, appointment.scheduling_round)
        appointment.scheduling_round += 1
        appointment.scheduling_turn = SchedulingTurn.CLIENT
        self.db.add(appointment)
        self.db.add(
            ProposedSlot(
                appointment_id=appointment.appointment_id,
                session_date=session_date,
                start_time=start_time,
                end_time=end_time,
                proposed_by=SlotProposer.PSYCHOLOGIST,
                status=SlotStatus.PROPOSED,
                round=appointment.scheduling_round,
            )
        )
        self.db.commit()
        self.db.refresh(appointment)
        return appointment

    def replace_preferences(
        self,
        appointment: Appointment,
        slot_rows: list[tuple],
    ) -> Appointment:
        self._decline_round(appointment.appointment_id, appointment.scheduling_round)
        appointment.scheduling_round += 1
        appointment.scheduling_turn = SchedulingTurn.PSYCHOLOGIST
        self.db.add(appointment)

        for session_date, start_time, end_time in slot_rows:
            self.db.add(
                ProposedSlot(
                    appointment_id=appointment.appointment_id,
                    session_date=session_date,
                    start_time=start_time,
                    end_time=end_time,
                    proposed_by=SlotProposer.CLIENT,
                    status=SlotStatus.PROPOSED,
                    round=appointment.scheduling_round,
                )
            )

        self.db.commit()
        self.db.refresh(appointment)
        return appointment

    def cancel(self, appointment: Appointment) -> Appointment:
        appointment.status = AppointmentStatus.CANCELLED
        appointment.scheduling_turn = None
        self.db.add(appointment)
        self.db.commit()
        self.db.refresh(appointment)
        return appointment

    def confirm(self, appointment: Appointment) -> Appointment:
        appointment.status = AppointmentStatus.CONFIRMED
        self.db.add(appointment)
        self.db.commit()
        self.db.refresh(appointment)
        return appointment

    def expire_if_overdue(self, appointment: Appointment) -> bool:
        """Release an agreed slot whose payment deadline has passed.

        The flow returns to the client, who must submit new preferred schedules;
        the psychologist then reviews them again. Returns True when the
        appointment was transitioned.
        """
        if appointment.status != AppointmentStatus.AWAITING_PAYMENT:
            return False
        if appointment.payment_deadline is None:
            return False
        if appointment.payment_deadline > now_manila():
            return False

        if appointment.selected_slot_id is not None:
            slot = self.db.get(ProposedSlot, appointment.selected_slot_id)
            if slot is not None:
                slot.status = SlotStatus.EXPIRED
                self.db.add(slot)

        appointment.selected_slot_id = None
        appointment.status = AppointmentStatus.AWAITING_SCHEDULE
        appointment.scheduling_turn = SchedulingTurn.CLIENT
        self.db.add(appointment)
        self.db.commit()
        self.db.refresh(appointment)
        return True

    # ----- enriched read models -----

    @staticmethod
    def _relation_value(persona: Persona) -> str:
        relation = persona.relation_to_account_holder
        return relation.value if hasattr(relation, "value") else str(relation)

    @staticmethod
    def _slot_read(slot: ProposedSlot) -> ProposedSlotRead:
        return ProposedSlotRead(
            slot_id=slot.slot_id,
            session_date=slot.session_date,
            start_time=slot.start_time,
            end_time=slot.end_time,
            proposed_by=slot.proposed_by,
            status=slot.status,
            round=slot.round,
        )

    def build_reads(self, appointments: list[Appointment]) -> list[AppointmentRead]:
        """Batch-load related entities and assemble AppointmentRead DTOs (no N+1)."""
        if not appointments:
            return []

        persona_ids = {appointment.persona_id for appointment in appointments}
        service_ids = {appointment.service_id for appointment in appointments}
        appointment_ids = {appointment.appointment_id for appointment in appointments}
        psychologist_ids = {
            appointment.psychologist_id
            for appointment in appointments
            if appointment.psychologist_id is not None
        }

        personas = {
            persona.persona_id: persona
            for persona in self.db.exec(
                select(Persona).where(Persona.persona_id.in_(persona_ids))
            ).all()
        }
        services = {
            service.service_id: service
            for service in self.db.exec(
                select(Service).where(Service.service_id.in_(service_ids))
            ).all()
        }
        psychologist_profiles = (
            {
                profile.psychologist_id: profile
                for profile in self.db.exec(
                    select(PsychologistProfile).where(
                        PsychologistProfile.psychologist_id.in_(psychologist_ids)
                    )
                ).all()
            }
            if psychologist_ids
            else {}
        )

        slots_by_appointment: dict[uuid.UUID, list[ProposedSlot]] = {
            appointment_id: [] for appointment_id in appointment_ids
        }
        for slot in self.db.exec(
            select(ProposedSlot).where(
                ProposedSlot.appointment_id.in_(appointment_ids)
            )
        ).all():
            slots_by_appointment[slot.appointment_id].append(slot)

        reads: list[AppointmentRead] = []
        for appointment in appointments:
            persona = personas.get(appointment.persona_id)
            service = services.get(appointment.service_id)
            contact_unlocked = appointment.status in (
                AppointmentStatus.CONFIRMED,
                AppointmentStatus.COMPLETED,
            )
            psychologist_profile = (
                psychologist_profiles.get(appointment.psychologist_id)
                if appointment.psychologist_id
                else None
            )
            social_links = (
                [
                    SocialMediaLink.model_validate(link)
                    for link in (psychologist_profile.social_media_links or [])
                ]
                if contact_unlocked and psychologist_profile
                else []
            )
            slots = sorted(
                slots_by_appointment.get(appointment.appointment_id, []),
                key=lambda slot: (slot.session_date, slot.start_time),
            )

            reads.append(
                AppointmentRead(
                    appointment_id=appointment.appointment_id,
                    persona_id=appointment.persona_id,
                    persona_name=persona.persona_name if persona else "",
                    persona_relation=(
                        self._relation_value(persona) if persona else ""
                    ),
                    service_id=appointment.service_id,
                    service_name=service.name if service else "",
                    service_duration_minutes=(
                        service.duration_minutes if service else None
                    ),
                    service_guardrail=(
                        service.guardrail_notice if service else None
                    ),
                    psychologist_id=appointment.psychologist_id,
                    selected_slot_id=appointment.selected_slot_id,
                    price=appointment.price,
                    presenting_concern=appointment.presenting_concern,
                    status=appointment.status,
                    requested_datetime=appointment.requested_datetime,
                    scheduling_turn=appointment.scheduling_turn,
                    scheduling_round=appointment.scheduling_round,
                    payment_deadline=appointment.payment_deadline,
                    proposed_slots=[self._slot_read(slot) for slot in slots],
                    persona_socmed_platform=(
                        persona.socmed_platform if persona else None
                    ),
                    persona_socmed_username=(
                        persona.socmed_username if persona else None
                    ),
                    psychologist_social_links=social_links,
                )
            )

        return reads

    def build_read(self, appointment: Appointment) -> AppointmentRead:
        return self.build_reads([appointment])[0]

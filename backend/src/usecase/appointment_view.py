"""Enriched appointment reads.

The UI needs persona/service display data and the proposed slot rows alongside
each appointment. Building that here (one batch query per relation) keeps the
list endpoints free of N+1 lookups and keeps controllers returning a single
response model.
"""

import uuid

from sqlmodel import Session, select

from models.appointment import Appointment, AppointmentStatus
from models.persona import Persona
from models.proposed_slot import ProposedSlot
from models.psychologist_profile import PsychologistProfile
from models.service import Service
from schemas.appointment import AppointmentRead, ProposedSlotRead
from schemas.psychologist import SocialMediaLink


def _relation_value(persona: Persona) -> str:
    relation = persona.relation_to_account_holder
    return relation.value if hasattr(relation, "value") else str(relation)


def _slot_read(slot: ProposedSlot) -> ProposedSlotRead:
    return ProposedSlotRead(
        slot_id=slot.slot_id,
        session_date=slot.session_date,
        start_time=slot.start_time,
        end_time=slot.end_time,
    )


def build_appointment_reads(
    db: Session, appointments: list[Appointment]
) -> list[AppointmentRead]:
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
        for persona in db.exec(
            select(Persona).where(Persona.persona_id.in_(persona_ids))
        ).all()
    }
    services = {
        service.service_id: service
        for service in db.exec(
            select(Service).where(Service.service_id.in_(service_ids))
        ).all()
    }
    psychologist_profiles = {
        profile.psychologist_id: profile
        for profile in db.exec(
            select(PsychologistProfile).where(
                PsychologistProfile.psychologist_id.in_(psychologist_ids)
            )
        ).all()
    } if psychologist_ids else {}

    slots_by_appointment: dict[uuid.UUID, list[ProposedSlot]] = {
        appointment_id: [] for appointment_id in appointment_ids
    }
    for slot in db.exec(
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
                persona_relation=_relation_value(persona) if persona else "",
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
                proposed_slots=[_slot_read(slot) for slot in slots],
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


def build_appointment_read(db: Session, appointment: Appointment) -> AppointmentRead:
    return build_appointment_reads(db, [appointment])[0]

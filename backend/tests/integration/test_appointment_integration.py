import uuid
from datetime import date, time
from sqlmodel import Session, select
from models.user import UserRole
from models.appointment import Appointment, AppointmentStatus
from models.proposed_slot import ProposedSlot


def test_book_appointment_end_to_end(
    client, auth_override, db_session: Session, create_client_user, create_persona, create_service
):
    """
    Test booking an appointment against local Supabase:
    Verifies persona validation, active service validation, and initial 'pending' state.
    """
    client_user, _ = create_client_user()
    persona = create_persona(client_id=client_user.user_id, persona_name="Booking Persona")
    service = create_service(name="Consultation Session", is_active=True)

    auth_override(sub=client_user.cognito_sub, role=UserRole.CLIENT.value)
    payload = {
        "persona_id": str(persona.persona_id),
        "service_id": str(service.service_id),
        "presenting_concern": "Persistent stress and sleep trouble",
    }

    res = client.post("/appointments", json=payload)
    assert res.status_code == 200, res.text
    data = res.json()
    appointment_id = uuid.UUID(data["appointment_id"])
    assert data["status"] == AppointmentStatus.PENDING.value
    assert data["presenting_concern"] == "Persistent stress and sleep trouble"

    # Verify persisted in Supabase DB
    db_appt = db_session.exec(select(Appointment).where(Appointment.appointment_id == appointment_id)).first()
    assert db_appt is not None
    assert db_appt.persona_id == persona.persona_id
    assert db_appt.service_id == service.service_id
    assert db_appt.status == AppointmentStatus.PENDING


def test_slot_selection_lifecycle(
    client, auth_override, db_session: Session, create_client_user, create_persona, create_service, create_appointment, create_proposed_slot
):
    """
    Test slot availability and client slot selection:
    1. Appointment transitions to 'awaiting_slot_selection' with proposed slots.
    2. Client retrieves available slots via GET /appointments/{id}/slots.
    3. Client selects slot via POST /appointments/{id}/select-slot.
    4. Appointment transitions to 'awaiting_payment'.
    """
    client_user, _ = create_client_user()
    persona = create_persona(client_id=client_user.user_id)
    service = create_service(name="Therapy Session", is_active=True)

    # 1. Create appointment in awaiting_slot_selection
    appt = create_appointment(
        persona_id=persona.persona_id,
        service_id=service.service_id,
        status=AppointmentStatus.AWAITING_SLOT_SELECTION,
    )
    slot1 = create_proposed_slot(
        appointment_id=appt.appointment_id,
        session_date=date(2026, 11, 15),
        start_time=time(9, 0),
        end_time=time(10, 0),
    )
    slot2 = create_proposed_slot(
        appointment_id=appt.appointment_id,
        session_date=date(2026, 11, 16),
        start_time=time(14, 0),
        end_time=time(15, 0),
    )

    auth_override(sub=client_user.cognito_sub, role=UserRole.CLIENT.value)

    # 2. Retrieve slots
    slots_res = client.get(f"/appointments/{appt.appointment_id}/slots")
    assert slots_res.status_code == 200
    slots_data = slots_res.json()
    assert len(slots_data) == 2
    slot_ids = [s["slot_id"] for s in slots_data]
    assert str(slot1.slot_id) in slot_ids
    assert str(slot2.slot_id) in slot_ids

    # 3. Select slot 1
    select_res = client.post(
        f"/appointments/{appt.appointment_id}/select-slot",
        json={"slot_id": str(slot1.slot_id)},
    )
    assert select_res.status_code == 200
    updated = select_res.json()
    assert updated["status"] == AppointmentStatus.AWAITING_PAYMENT.value
    assert updated["selected_slot_id"] == str(slot1.slot_id)

    # 4. Check database state
    db_session.refresh(appt)
    assert appt.status == AppointmentStatus.AWAITING_PAYMENT
    assert appt.selected_slot_id == slot1.slot_id


def test_cancel_appointment(
    client, auth_override, db_session: Session, create_client_user, create_persona, create_service, create_appointment
):
    """Test cancelling an appointment updates its status to 'cancelled' in Supabase."""
    client_user, _ = create_client_user()
    persona = create_persona(client_id=client_user.user_id)
    service = create_service()
    appt = create_appointment(persona_id=persona.persona_id, service_id=service.service_id, status=AppointmentStatus.PENDING)

    auth_override(sub=client_user.cognito_sub, role=UserRole.CLIENT.value)
    res = client.delete(f"/appointments/{appt.appointment_id}")
    assert res.status_code == 200
    assert res.json()["status"] == AppointmentStatus.CANCELLED.value

    db_session.refresh(appt)
    assert appt.status == AppointmentStatus.CANCELLED

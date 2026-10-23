import uuid
from datetime import datetime, timezone
from sqlmodel import Session, select

from models.user import UserRole
from models.appointment import Appointment, AppointmentStatus
from models.payment import Payment, PaymentStatus
from services.payments.fake_provider import FakePaymentProvider
from usecase.payment_usecase import PaymentUsecase


def test_initiate_payment_persists_in_supabase(
    client, auth_override, db_session: Session, create_client_user, create_persona, create_service, create_appointment
):
    """
    Test initiating payment for an appointment:
    - Verifies checkout URL generation via Fake provider
    - Verifies payment record is stored in Supabase with foreign key to appointment
    - Verifies GET /appointments/{id}/payment returns the payment history
    """
    client_user, _ = create_client_user()
    persona = create_persona(client_id=client_user.user_id)
    service = create_service()
    appt = create_appointment(
        persona_id=persona.persona_id,
        service_id=service.service_id,
        price=2500.0,
        status=AppointmentStatus.AWAITING_PAYMENT,
    )

    auth_override(sub=client_user.cognito_sub, role=UserRole.CLIENT.value)

    res = client.post(f"/appointments/{appt.appointment_id}/payment")
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["amount"] == 2500.0
    assert data["status"] == PaymentStatus.PENDING.value
    assert data["provider"] == "fake"
    assert data["checkout_url"] is not None
    payment_id = uuid.UUID(data["payment_id"])

    # Verify directly in Supabase Postgres DB
    db_payment = db_session.exec(select(Payment).where(Payment.payment_id == payment_id)).first()
    assert db_payment is not None
    assert db_payment.appointment_id == appt.appointment_id
    assert db_payment.amount == 2500.0
    assert db_payment.status == PaymentStatus.PENDING

    # Test history endpoint
    history_res = client.get(f"/appointments/{appt.appointment_id}/payment")
    assert history_res.status_code == 200
    history = history_res.json()
    assert len(history) == 1
    assert history[0]["payment_id"] == str(payment_id)


def test_payment_webhook_fulfillment_confirms_appointment(
    db_session: Session, create_client_user, create_persona, create_service, create_appointment
):
    """
    Integration test for webhook fulfillment:
    When a paid event arrives for a pending payment in Supabase:
    - Payment is marked as PAID with paid_at timestamp
    - The linked appointment transitions from AWAITING_PAYMENT to CONFIRMED
    """
    client_user, _ = create_client_user()
    persona = create_persona(client_id=client_user.user_id)
    service = create_service()
    appt = create_appointment(
        persona_id=persona.persona_id,
        service_id=service.service_id,
        price=1800.0,
        status=AppointmentStatus.AWAITING_PAYMENT,
    )

    provider_ref = f"cs_test_{uuid.uuid4()}"
    payment = Payment(
        payment_id=uuid.uuid4(),
        appointment_id=appt.appointment_id,
        amount=1800.0,
        provider="fake",
        provider_ref=provider_ref,
        checkout_url=f"https://checkout.fake/{provider_ref}",
        status=PaymentStatus.PENDING,
    )
    db_session.add(payment)
    db_session.commit()

    provider = FakePaymentProvider()
    uc = PaymentUsecase(db_session, provider)

    # Process successful payment event
    paid_payment = uc.handle_webhook(
        provider_ref=provider_ref,
        paid=True,
        payment_method="gcash",
    )

    assert paid_payment.status == PaymentStatus.PAID
    assert paid_payment.paid_at is not None
    assert paid_payment.payment_method == "gcash"

    # Verify appointment transitioned to CONFIRMED in Supabase
    db_session.refresh(appt)
    assert appt.status == AppointmentStatus.CONFIRMED

    # Verify in DB via fresh query
    persisted_appt = db_session.exec(
        select(Appointment).where(Appointment.appointment_id == appt.appointment_id)
    ).first()
    assert persisted_appt is not None
    assert persisted_appt.status == AppointmentStatus.CONFIRMED

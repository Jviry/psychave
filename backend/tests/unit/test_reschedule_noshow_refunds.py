from datetime import date, datetime, time, timedelta, timezone
import json
import uuid

import httpx
import pytest
from sqlmodel import SQLModel, Session, create_engine, select
from sqlmodel.pool import StaticPool

from common.exceptions import BadRequestError
from common.time import now_manila
from models.appointment import Appointment, AppointmentStatus, SchedulingTurn
from models.client_profile import ClientProfile
from models.payment import Payment, PaymentStatus, PaymentType
from models.profile import Profile, ProfileRelation
from models.proposed_slot import ProposedSlot, SlotProposer, SlotStatus
from models.psychologist_profile import PsychologistProfile
from models.service import Service
from models.user import User, UserRole
from schemas.admin import AdminRefundRequest
from services.auth.fake_service import FakeAuthService
from services.email.base import BaseEmailService
from services.payments.base import InitiatedPayment, RefundResult, WebhookEvent
from services.payments.paymongo_provider import PayMongoPaymentProvider
from usecase.admin_usecase import AdminUsecase
from usecase.appointment_usecase import AppointmentUsecase
from usecase.payment_usecase import PaymentUsecase, RESCHEDULE_FEE_PHP
from usecase.psychologist_usecase import PsychologistUsecase


class _SilentEmailService(BaseEmailService):
    def send_email(self, to: str, subject: str, html: str, text: str) -> None:
        pass


class _FakePaymentProvider:
    name = "paymongo"

    def __init__(self):
        self.checkouts: list[dict] = []
        self.refunds: list[dict] = []

    def create_checkout(self, **kwargs) -> InitiatedPayment:
        self.checkouts.append(kwargs)
        return InitiatedPayment(
            provider_ref=f"cs_{uuid.uuid4().hex[:8]}",
            checkout_url="https://checkout.paymongo.com/cs_test",
        )

    def create_refund(self, **kwargs) -> RefundResult:
        self.refunds.append(kwargs)
        return RefundResult(
            refund_id="re_test_123",
            status="pending",
            amount_centavos=kwargs["amount_centavos"],
        )

    def verify_signature(self, raw_body, headers) -> bool:
        return True

    def parse_webhook(self, raw_body, headers):
        return None


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        yield s


def _seed_confirmed(
    db: Session,
    *,
    session_offset: timedelta,
    with_paid_session: bool = True,
):
    client = User(
        user_id=uuid.uuid4(),
        cognito_sub=f"sub-{uuid.uuid4()}",
        email="client@example.com",
        role=UserRole.CLIENT.value,
    )
    psych = User(
        user_id=uuid.uuid4(),
        cognito_sub=f"sub-{uuid.uuid4()}",
        email="psych@example.com",
        role=UserRole.PSYCHOLOGIST.value,
    )
    admin = User(
        user_id=uuid.uuid4(),
        cognito_sub=f"sub-{uuid.uuid4()}",
        email="admin@example.com",
        role=UserRole.ADMIN.value,
    )
    db.add_all([client, psych, admin])
    db.flush()

    db.add(ClientProfile(client_id=client.user_id, full_name="Client One"))
    db.add(
        PsychologistProfile(
            psychologist_id=psych.user_id,
            full_name="Dr. Psych",
            social_media_links=[{"platform": "Messenger", "url": "https://m.me/drpsych"}],
        )
    )
    profile = Profile(
        profile_id=uuid.uuid4(),
        client_id=client.user_id,
        relation_to_account_holder=ProfileRelation.self_,
        profile_name="Client One",
        date_of_birth=date(1995, 1, 1),
    )
    service = Service(
        service_id=uuid.uuid4(),
        name="Individual Counseling",
        description="50 min",
        duration_minutes=50,
        price=1500.0,
        is_active=True,
    )
    db.add_all([profile, service])
    db.flush()

    target_dt = now_manila() + session_offset
    appt = Appointment(
        profile_id=profile.profile_id,
        service_id=service.service_id,
        psychologist_id=psych.user_id,
        price=1500.0,
        presenting_concern="Anxiety",
        status=AppointmentStatus.CONFIRMED,
        scheduling_round=1,
    )
    db.add(appt)
    db.flush()

    slot = ProposedSlot(
        appointment_id=appt.appointment_id,
        session_date=target_dt.date(),
        start_time=target_dt.time().replace(microsecond=0),
        end_time=(target_dt + timedelta(minutes=50)).time().replace(microsecond=0),
        proposed_by=SlotProposer.CLIENT,
        status=SlotStatus.ACCEPTED,
        round=1,
    )
    db.add(slot)
    db.flush()
    appt.selected_slot_id = slot.slot_id
    db.add(appt)

    if with_paid_session:
        db.add(
            Payment(
                appointment_id=appt.appointment_id,
                amount=1500.0,
                payment_type=PaymentType.SESSION,
                provider="paymongo",
                provider_ref="cs_session_123",
                gateway_payment_id="pay_session_123",
                status=PaymentStatus.PAID,
                paid_at=datetime.now(timezone.utc),
            )
        )

    db.commit()
    db.refresh(appt)
    return appt, client, psych, admin


def test_client_reschedule_free_when_at_least_2h_before(db: Session):
    appt, client, _, _ = _seed_confirmed(db, session_offset=timedelta(hours=5))
    uc = AppointmentUsecase(db, email_service=_SilentEmailService())

    res = uc.request_reschedule(
        appt.appointment_id, client.user_id, UserRole.CLIENT, reason="Conflict"
    )
    assert res.status == AppointmentStatus.AWAITING_SCHEDULE
    assert res.scheduling_turn == SchedulingTurn.PSYCHOLOGIST
    assert res.selected_slot_id is None
    assert res.reschedule_requested_by == "client"
    assert res.reschedule_reason == "Conflict"


def test_client_reschedule_requires_fee_when_under_2h(db: Session):
    appt, client, _, _ = _seed_confirmed(db, session_offset=timedelta(minutes=45))
    uc = AppointmentUsecase(db, email_service=_SilentEmailService())

    res = uc.request_reschedule(
        appt.appointment_id, client.user_id, UserRole.CLIENT, reason="Emergency"
    )
    assert res.status == AppointmentStatus.RESCHEDULE_REQUESTED
    assert res.scheduling_turn is None
    assert res.reschedule_fee_waived is False


def test_psychologist_reschedule_is_always_free(db: Session):
    appt, _, psych, _ = _seed_confirmed(db, session_offset=timedelta(minutes=20))
    uc = AppointmentUsecase(db, email_service=_SilentEmailService())

    res = uc.request_reschedule(
        appt.appointment_id, psych.user_id, UserRole.PSYCHOLOGIST, reason="Clinic conflict"
    )
    assert res.status == AppointmentStatus.AWAITING_SCHEDULE
    assert res.scheduling_turn == SchedulingTurn.CLIENT
    assert res.reschedule_requested_by == "psychologist"


def test_mark_no_show_enforces_after_session_start(db: Session):
    appt_future, _, psych, _ = _seed_confirmed(db, session_offset=timedelta(hours=2))
    psych_uc = PsychologistUsecase(db, email_service=_SilentEmailService())

    with pytest.raises(BadRequestError):
        psych_uc.mark_no_show(appt_future.appointment_id, psych.user_id)

    appt_past, _, psych2, _ = _seed_confirmed(db, session_offset=timedelta(minutes=-30))
    res = psych_uc.mark_no_show(appt_past.appointment_id, psych2.user_id)
    assert res.status == AppointmentStatus.NO_SHOW


def test_waive_reschedule_fee_transitions_to_awaiting_schedule(db: Session):
    appt, _, psych, _ = _seed_confirmed(db, session_offset=timedelta(minutes=-30))
    psych_uc = PsychologistUsecase(db, email_service=_SilentEmailService())
    psych_uc.mark_no_show(appt.appointment_id, psych.user_id)

    waived = psych_uc.waive_reschedule_fee(appt.appointment_id, psych.user_id)
    assert waived.status == AppointmentStatus.AWAITING_SCHEDULE
    assert waived.scheduling_turn == SchedulingTurn.CLIENT
    assert waived.reschedule_fee_waived is True


def test_reschedule_fee_checkout_and_webhook_then_slot_reagreement_confirms(db: Session):
    appt, client, psych, _ = _seed_confirmed(db, session_offset=timedelta(minutes=30))
    appt_uc = AppointmentUsecase(db, email_service=_SilentEmailService())
    psych_uc = PsychologistUsecase(db, email_service=_SilentEmailService())
    provider = _FakePaymentProvider()
    pay_uc = PaymentUsecase(db, provider, email_service=_SilentEmailService())

    appt_uc.request_reschedule(appt.appointment_id, client.user_id, UserRole.CLIENT)
    fee_payment = pay_uc.initiate_reschedule_fee_payment(appt.appointment_id, client.user_id)

    assert fee_payment.amount == RESCHEDULE_FEE_PHP
    assert fee_payment.payment_type == PaymentType.RESCHEDULE_FEE
    assert provider.checkouts[0]["amount"] == 600.0

    pay_uc.handle_webhook(provider_ref=fee_payment.provider_ref, paid=True, payment_method="gcash")
    db.refresh(appt)
    assert appt.status == AppointmentStatus.AWAITING_SCHEDULE
    assert appt.scheduling_turn == SchedulingTurn.CLIENT

    # Client proposes new slot and psychologist accepts -> should confirm immediately (already paid!)
    future_day = (now_manila() + timedelta(days=3)).date()
    slot1 = ProposedSlot(
        appointment_id=appt.appointment_id,
        session_date=future_day,
        start_time=time(10, 0),
        end_time=time(10, 50),
        proposed_by=SlotProposer.CLIENT,
        status=SlotStatus.PROPOSED,
        round=2,
    )
    appt.scheduling_round = 2
    appt.scheduling_turn = SchedulingTurn.PSYCHOLOGIST
    db.add_all([appt, slot1])
    db.commit()
    db.refresh(slot1)

    confirmed = psych_uc.accept_preferred_slot(appt.appointment_id, slot1.slot_id, psych.user_id)
    assert confirmed.status == AppointmentStatus.CONFIRMED
    assert confirmed.payment_deadline is None


def test_admin_partial_refund_validates_and_records_audit_trail(db: Session):
    appt, _, _, admin = _seed_confirmed(db, session_offset=timedelta(hours=4))
    provider = _FakePaymentProvider()
    admin_uc = AdminUsecase(FakeAuthService(), db, email_service=_SilentEmailService())

    with pytest.raises(BadRequestError):
        admin_uc.refund_appointment(
            appt.appointment_id,
            AdminRefundRequest(amount_centavos=150000, reason="Full not allowed"),
            acting_admin_id=admin.user_id,
            provider=provider,
        )

    with pytest.raises((BadRequestError, ValueError)):
        admin_uc.refund_appointment(
            appt.appointment_id,
            AdminRefundRequest(amount_centavos=0, reason="Zero not allowed"),
            acting_admin_id=admin.user_id,
            provider=provider,
        )

    with pytest.raises(ValueError):
        AdminRefundRequest(amount_centavos=50000, percentage=50, reason="Both")

    with pytest.raises(ValueError):
        AdminRefundRequest(percentage=100, reason="Full pct not allowed")

    res = admin_uc.refund_appointment(
        appt.appointment_id,
        AdminRefundRequest(percentage=50, reason="Client cancelled partial"),
        acting_admin_id=admin.user_id,
        provider=provider,
    )
    assert res.status == AppointmentStatus.PARTIALLY_REFUNDED
    assert res.refund_amount_centavos == 75000
    assert res.refund_reason == "Client cancelled partial"
    assert len(provider.refunds) == 1
    assert provider.refunds[0]["payment_id"] == "pay_session_123"
    assert provider.refunds[0]["amount_centavos"] == 75000

    payment = db.exec(
        select(Payment).where(
            Payment.appointment_id == appt.appointment_id,
            Payment.payment_type == PaymentType.SESSION,
        )
    ).first()
    assert payment is not None
    assert payment.status == PaymentStatus.PARTIALLY_REFUNDED
    assert payment.refund_ref == "re_test_123"
    assert payment.refund_amount_centavos == 75000


def test_paymongo_create_refund_and_refund_webhook():
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/v1/refunds"
        body = json.loads(request.content.decode("utf-8"))
        assert body["data"]["attributes"]["amount"] == 50000
        assert body["data"]["attributes"]["payment_id"] == "pay_abc"
        return httpx.Response(
            200,
            json={
                "data": {
                    "id": "re_999",
                    "attributes": {"status": "succeeded", "amount": 50000},
                }
            },
        )

    client = httpx.Client(transport=httpx.MockTransport(handler))
    provider = PayMongoPaymentProvider(secret_key="sk_test_123", client=client)
    res = provider.create_refund(payment_id="pay_abc", amount_centavos=50000, reason="Partial")
    assert res.refund_id == "re_999"
    assert res.amount_centavos == 50000

    webhook_payload = json.dumps(
        {
            "data": {
                "attributes": {
                    "type": "payment.refunded",
                    "data": {
                        "id": "re_999",
                        "attributes": {
                            "payment_id": "pay_abc",
                            "amount": 50000,
                            "status": "succeeded",
                        },
                    },
                }
            }
        }
    ).encode("utf-8")
    event = provider.parse_webhook(webhook_payload, {})
    assert event is not None
    assert event.event_type == "payment.refunded"
    assert event.gateway_payment_id == "pay_abc"
    assert event.refund_id == "re_999"
    assert event.refund_amount_centavos == 50000


def test_paymongo_parse_webhook_payment_object_and_failed_refund_ignored(db: Session):
    provider = PayMongoPaymentProvider(secret_key="sk_test_123")
    payment_obj_webhook = json.dumps(
        {
            "data": {
                "attributes": {
                    "type": "payment.refunded",
                    "data": {
                        "id": "pay_session_123",
                        "type": "payment",
                        "attributes": {
                            "refunds": [
                                {
                                    "id": "re_1",
                                    "type": "refund",
                                    "attributes": {
                                        "amount": 50000,
                                        "status": "succeeded",
                                    },
                                }
                            ]
                        },
                    },
                }
            }
        }
    ).encode("utf-8")
    event = provider.parse_webhook(payment_obj_webhook, {})
    assert event is not None
    assert event.gateway_payment_id == "pay_session_123"
    assert event.refund_id == "re_1"
    assert event.refund_amount_centavos == 50000
    assert event.refund_status == "succeeded"

    appt, _, _, _ = _seed_confirmed(db, session_offset=timedelta(hours=4))
    pay_uc = PaymentUsecase(db, provider, email_service=_SilentEmailService())
    res = pay_uc.handle_webhook(
        provider_ref="pay_session_123",
        paid=True,
        gateway_payment_id="pay_session_123",
        event_type="payment.refund.updated",
        refund_id="re_fail",
        refund_amount_centavos=50000,
        refund_status="failed",
    )
    db.refresh(appt)
    assert res.status == PaymentStatus.PAID
    assert appt.status == AppointmentStatus.CONFIRMED


def test_paid_rescheduled_appointment_blocks_cancel_and_exposes_is_session_paid(db: Session):
    appt, client, _, _ = _seed_confirmed(db, session_offset=timedelta(hours=5))
    appt_uc = AppointmentUsecase(db, email_service=_SilentEmailService())

    res = appt_uc.request_reschedule(appt.appointment_id, client.user_id, UserRole.CLIENT)
    assert res.status == AppointmentStatus.AWAITING_SCHEDULE
    assert res.is_session_paid is True

    with pytest.raises(BadRequestError, match="Paid appointments cannot be cancelled"):
        appt_uc.cancel_appointment(appt.appointment_id, client.user_id)


def test_admin_refund_resolves_missing_gateway_payment_id_and_replaces_mismatched_pending(db: Session):
    appt, client, _, admin = _seed_confirmed(
        db, session_offset=timedelta(minutes=30), with_paid_session=False
    )
    # Seed paid session missing gateway_payment_id
    paid_session = Payment(
        appointment_id=appt.appointment_id,
        amount=1500.0,
        payment_type=PaymentType.SESSION,
        provider="paymongo",
        provider_ref="cs_session_missing_pay_id",
        gateway_payment_id=None,
        status=PaymentStatus.PAID,
        paid_at=datetime.now(timezone.utc),
    )
    # Seed stale pending SESSION payment alongside a reschedule request
    stale_pending = Payment(
        appointment_id=appt.appointment_id,
        amount=1500.0,
        payment_type=PaymentType.SESSION,
        provider="paymongo",
        provider_ref="cs_stale_session",
        status=PaymentStatus.PENDING,
    )
    db.add_all([paid_session, stale_pending])
    db.commit()

    class _FetchProvider(_FakePaymentProvider):
        def fetch_checkout_status(self, provider_ref: str):
            return WebhookEvent(
                provider_ref=provider_ref,
                paid=True,
                payment_method="gcash",
                gateway_payment_id="pay_resolved_999",
                event_type="checkout_session.payment.paid",
            )

    provider = _FetchProvider()
    appt_uc = AppointmentUsecase(db, email_service=_SilentEmailService())
    appt_uc.request_reschedule(appt.appointment_id, client.user_id, UserRole.CLIENT)

    pay_uc = PaymentUsecase(db, provider, email_service=_SilentEmailService())
    fee_pay = pay_uc.initiate_reschedule_fee_payment(appt.appointment_id, client.user_id)
    assert fee_pay.payment_type == PaymentType.RESCHEDULE_FEE
    db.refresh(stale_pending)
    assert stale_pending.status == PaymentStatus.FAILED

    admin_uc = AdminUsecase(FakeAuthService(), db, email_service=_SilentEmailService())
    refunded = admin_uc.refund_appointment(
        appt.appointment_id,
        AdminRefundRequest(amount_centavos=50000, reason="Goodwill"),
        acting_admin_id=admin.user_id,
        provider=provider,
    )
    assert refunded.status == AppointmentStatus.PARTIALLY_REFUNDED
    assert provider.refunds[0]["payment_id"] == "pay_resolved_999"


def test_alembic_migration_runs_cleanly_without_pg_enum_types():
    from pathlib import Path
    import importlib.util
    from alembic.migration import MigrationContext
    from alembic.operations import Operations
    import sqlalchemy as sa

    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    with engine.begin() as conn:
        conn.execute(
            sa.text(
                "CREATE TABLE appointments (appointment_id VARCHAR PRIMARY KEY, status VARCHAR NOT NULL)"
            )
        )
        conn.execute(
            sa.text(
                "CREATE TABLE payments (payment_id VARCHAR PRIMARY KEY, status VARCHAR NOT NULL)"
            )
        )

    mig_path = (
        Path(__file__).resolve().parents[2]
        / "alembic"
        / "versions"
        / "f7a8b9c0d1e2_add_reschedule_noshow_refunds.py"
    )
    spec = importlib.util.spec_from_file_location("mig_f7a8b9c0d1e2", mig_path)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    with engine.begin() as conn:
        ctx = MigrationContext.configure(conn)
        with Operations.context(ctx):
            mod.op = Operations(ctx)
            mod.upgrade()

        appt_cols = {row[1] for row in conn.execute(sa.text("PRAGMA table_info(appointments)"))}
        pay_cols = {row[1] for row in conn.execute(sa.text("PRAGMA table_info(payments)"))}
        assert {"reschedule_fee_waived", "reschedule_requested_by", "reschedule_reason", "refund_amount_centavos", "refund_reason", "refunded_at", "refunded_by"}.issubset(appt_cols)
        assert {"payment_type", "gateway_payment_id", "refund_amount_centavos", "refund_ref", "refund_reason", "refunded_at"}.issubset(pay_cols)


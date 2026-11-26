import uuid
from datetime import date, datetime, timedelta, timezone
from unittest.mock import MagicMock
import pytest
from sqlalchemy.exc import IntegrityError
from sqlmodel import SQLModel, Session, create_engine
from sqlmodel.pool import StaticPool

from common.exceptions import ConflictError
from models.appointment import Appointment, AppointmentStatus, SchedulingTurn
from models.client_profile import ClientProfile
from models.payment import Payment, PaymentStatus
from models.profile import Profile, ProfileRelation
from models.service import Service
from models.user import User, UserRole
from repo.appointment_repo import AppointmentRepo
from repo.consent_template_repo import ConsentTemplateRepo
from repo.payment_repo import PaymentRepo
from schemas.appointment import AppointmentCreate, SlotInput
from services.email.base import BaseEmailService
from usecase.appointment_usecase import AppointmentUsecase


class _NoopEmailService(BaseEmailService):
    def send_email(self, to: str, subject: str, html: str, text: str) -> None:
        return None


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        ConsentTemplateRepo(s).ensure_default_seeded()
        yield s


def test_create_appointment_rejects_profile_without_consent_form(db_session: Session):
    client = User(
        user_id=uuid.uuid4(),
        cognito_sub=f"sub-{uuid.uuid4()}",
        email="noconsent@example.com",
        role=UserRole.CLIENT.value,
    )
    db_session.add(client)
    db_session.flush()
    db_session.add(ClientProfile(client_id=client.user_id, full_name="No Consent"))
    profile = Profile(
        profile_id=uuid.uuid4(),
        client_id=client.user_id,
        relation_to_account_holder=ProfileRelation.self_,
        profile_name="No Consent",
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
    db_session.add(profile)
    db_session.add(service)
    db_session.commit()

    base_day = (datetime.now(timezone.utc) + timedelta(days=3)).date()
    payload = AppointmentCreate(
        profile_id=profile.profile_id,
        service_id=service.service_id,
        presenting_concern="Stress",
        preferred_slots=[
            SlotInput(session_date=base_day, start_time="09:00"),
            SlotInput(session_date=base_day + timedelta(days=1), start_time="10:00"),
            SlotInput(session_date=base_day + timedelta(days=2), start_time="11:00"),
        ],
    )
    uc = AppointmentUsecase(db_session, email_service=_NoopEmailService())
    with pytest.raises(ConflictError, match="Consent form is missing"):
        uc.create_appointment(payload, client.user_id)


def test_cancel_appointment_marks_pending_payments_failed(db_session: Session):
    client = User(
        user_id=uuid.uuid4(),
        cognito_sub=f"sub-{uuid.uuid4()}",
        email="cancel@example.com",
        role=UserRole.CLIENT.value,
    )
    db_session.add(client)
    db_session.flush()
    db_session.add(ClientProfile(client_id=client.user_id, full_name="Cancel Client"))
    profile = Profile(
        profile_id=uuid.uuid4(),
        client_id=client.user_id,
        relation_to_account_holder=ProfileRelation.self_,
        profile_name="Cancel Client",
        date_of_birth=date(1995, 1, 1),
    )
    db_session.add(profile)
    db_session.flush()
    appt = Appointment(
        profile_id=profile.profile_id,
        service_id=uuid.uuid4(),
        presenting_concern="Follow-up",
        status=AppointmentStatus.AWAITING_PAYMENT,
        scheduling_turn=SchedulingTurn.CLIENT,
    )
    db_session.add(appt)
    db_session.flush()
    payment = Payment(
        appointment_id=appt.appointment_id,
        amount=1500.0,
        provider="paymongo",
        provider_ref="cs_cancel_1",
        status=PaymentStatus.PENDING,
    )
    db_session.add(payment)
    db_session.commit()

    repo = AppointmentRepo(db_session)
    repo.cancel(appt)
    db_session.refresh(payment)
    assert appt.status == AppointmentStatus.CANCELLED
    assert payment.status == PaymentStatus.FAILED


def test_payment_repo_create_returns_existing_on_integrity_error():
    appt_id = uuid.uuid4()
    existing = Payment(
        payment_id=uuid.uuid4(),
        appointment_id=appt_id,
        amount=1500.0,
        provider="paymongo",
        provider_ref="cs_existing",
        status=PaymentStatus.PENDING,
    )
    db = MagicMock(spec=Session)
    db.commit.side_effect = IntegrityError("dup", {}, Exception("unique"))
    mock_exec = MagicMock()
    mock_exec.first.return_value = existing
    db.exec.return_value = mock_exec

    repo = PaymentRepo(db)
    res = repo.create(
        appointment_id=appt_id,
        amount=1500.0,
        provider="paymongo",
        provider_ref="cs_new",
        checkout_url="https://checkout.paymongo.com/cs_new",
    )
    assert res == existing
    assert db.rollback.called

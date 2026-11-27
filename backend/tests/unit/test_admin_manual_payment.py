import uuid
from datetime import date, datetime, timedelta, timezone
import pytest
from sqlmodel import SQLModel, Session, create_engine, select
from sqlmodel.pool import StaticPool

from common.exceptions import BadRequestError
from models.appointment import Appointment, AppointmentStatus
from models.client_profile import ClientProfile
from models.payment import Payment, PaymentStatus
from models.profile import Profile, ProfileRelation
from models.psychologist_profile import PsychologistProfile
from models.service import Service
from models.user import User, UserRole
from repo.appointment_repo import AppointmentRepo
from services.auth.fake_service import FakeAuthService
from services.email.base import BaseEmailService
from usecase.admin_usecase import AdminUsecase


class _RecordingEmailService(BaseEmailService):
    def __init__(self):
        super().__init__()
        self.sent: list[tuple[str, str]] = []

    def send_email(self, to: str, subject: str, html: str, text: str) -> None:
        self.sent.append((to, subject))


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        yield s


def _seed_awaiting_payment(db: Session, status: AppointmentStatus = AppointmentStatus.AWAITING_PAYMENT):
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
    db.add(client)
    db.add(psych)
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
    db.add(profile)
    db.add(service)
    db.flush()
    appt = Appointment(
        profile_id=profile.profile_id,
        service_id=service.service_id,
        psychologist_id=psych.user_id,
        price=1500.0,
        presenting_concern="Anxiety",
        status=status,
        payment_deadline=datetime.now(timezone.utc) + timedelta(hours=24),
    )
    db.add(appt)
    db.commit()
    return appt


def test_admin_confirm_manual_payment_confirms_appointment_and_unlocks_links(db_session: Session):
    appt = _seed_awaiting_payment(db_session, AppointmentStatus.AWAITING_PAYMENT)
    email_svc = _RecordingEmailService()
    uc = AdminUsecase(FakeAuthService(), db_session, email_service=email_svc)

    # Social links are already unlocked upon pickup
    pre_read = AppointmentRepo(db_session).build_read(appt)
    assert len(pre_read.psychologist_social_links) == 1

    res = uc.confirm_manual_payment(appt.appointment_id, note="GCash ref 12345")
    assert res.status == AppointmentStatus.CONFIRMED

    payments = db_session.exec(
        select(Payment).where(Payment.appointment_id == appt.appointment_id)
    ).all()
    assert len(payments) == 1
    assert payments[0].provider == "manual"
    assert payments[0].status == PaymentStatus.PAID
    assert payments[0].provider_ref == "GCash ref 12345"
    assert len(email_svc.sent) == 2


def test_admin_confirm_manual_payment_rejects_non_awaiting_payment(db_session: Session):
    appt = _seed_awaiting_payment(db_session, AppointmentStatus.PENDING)
    uc = AdminUsecase(FakeAuthService(), db_session, email_service=_RecordingEmailService())

    with pytest.raises(BadRequestError, match="awaiting payment"):
        uc.confirm_manual_payment(appt.appointment_id)

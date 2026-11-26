import uuid
from datetime import date, datetime, timedelta, timezone
import pytest
from sqlmodel import SQLModel, Session, create_engine
from sqlmodel.pool import StaticPool

from common.exceptions import BadRequestError, ConflictError
from common.time import now_manila
from jobs.scheduled_tasks import run_scheduled_tasks
from models.appointment import Appointment, AppointmentStatus, SchedulingTurn
from models.client_profile import ClientProfile
from models.profile import Profile, ProfileRelation
from models.proposed_slot import ProposedSlot, SlotProposer, SlotStatus
from models.psychologist_profile import PsychologistProfile
from models.service import Service
from models.user import User, UserRole
from schemas.cms import CmsContentUpdate
from services.email.base import BaseEmailService
from usecase.cms_usecase import CmsUsecase
from usecase.psychologist_usecase import PsychologistUsecase


class _RecordingEmailService(BaseEmailService):
    def __init__(self):
        super().__init__()
        self.sent: list[tuple[str, str, str]] = []

    def send_email(self, to: str, subject: str, html: str, text: str) -> None:
        self.sent.append((to, subject, text))


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


def _seed_base(db: Session):
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
    db.commit()
    return client, psych, admin, profile, service


def test_scheduled_tasks_expires_overdue_payment_and_alerts_sla(db_session: Session):
    client, psych, admin, profile, service = _seed_base(db_session)

    # 1. Overdue awaiting_payment
    overdue_appt = Appointment(
        profile_id=profile.profile_id,
        service_id=service.service_id,
        psychologist_id=psych.user_id,
        price=1500.0,
        presenting_concern="Burnout",
        status=AppointmentStatus.AWAITING_PAYMENT,
        payment_deadline=now_manila() - timedelta(minutes=30),
    )
    # 2. Stale pending > 25h (alerts psychologists) and > 49h (alerts admins)
    stale_pending_24h = Appointment(
        profile_id=profile.profile_id,
        service_id=service.service_id,
        presenting_concern="Sleep",
        status=AppointmentStatus.PENDING,
        requested_datetime=datetime.now(timezone.utc).replace(tzinfo=None)
        - timedelta(hours=26),
    )
    stale_pending_48h = Appointment(
        profile_id=profile.profile_id,
        service_id=service.service_id,
        presenting_concern="Work",
        status=AppointmentStatus.PENDING,
        requested_datetime=datetime.now(timezone.utc).replace(tzinfo=None)
        - timedelta(hours=49),
    )
    db_session.add_all([overdue_appt, stale_pending_24h, stale_pending_48h])
    db_session.commit()

    emailer = _RecordingEmailService()
    summary = run_scheduled_tasks(db_session, email_service=emailer)
    assert summary["expired_payments"] == 1
    assert summary["sla_alerts"] == 2

    db_session.refresh(overdue_appt)
    db_session.refresh(stale_pending_24h)
    db_session.refresh(stale_pending_48h)
    assert overdue_appt.status == AppointmentStatus.AWAITING_SCHEDULE
    assert overdue_appt.scheduling_turn == SchedulingTurn.CLIENT
    assert stale_pending_24h.sla_24h_alerted_at is not None
    assert stale_pending_48h.sla_48h_alerted_at is not None

    recipients = {to for to, _, _ in emailer.sent}
    assert "psych@example.com" in recipients
    assert "admin@example.com" in recipients

    # Idempotent second run does not re-alert
    summary_2 = run_scheduled_tasks(db_session, email_service=emailer)
    assert summary_2["expired_payments"] == 0
    assert summary_2["sla_alerts"] == 0


def test_scheduled_tasks_sends_24h_and_1h_reminders_idempotently(db_session: Session):
    client, psych, admin, profile, service = _seed_base(db_session)
    soon = now_manila() + timedelta(minutes=45)
    appt = Appointment(
        profile_id=profile.profile_id,
        service_id=service.service_id,
        psychologist_id=psych.user_id,
        price=1500.0,
        presenting_concern="Stress",
        status=AppointmentStatus.CONFIRMED,
        meeting_link="https://meet.google.com/test-room",
    )
    db_session.add(appt)
    db_session.flush()
    slot = ProposedSlot(
        appointment_id=appt.appointment_id,
        session_date=soon.date(),
        start_time=soon.time().replace(microsecond=0),
        end_time=(soon + timedelta(minutes=50)).time().replace(microsecond=0),
        proposed_by=SlotProposer.CLIENT,
        status=SlotStatus.ACCEPTED,
        round=1,
    )
    db_session.add(slot)
    db_session.flush()
    appt.selected_slot_id = slot.slot_id
    db_session.add(appt)
    db_session.commit()

    emailer = _RecordingEmailService()
    summary = run_scheduled_tasks(db_session, email_service=emailer)
    assert summary["reminders_sent"] == 1
    assert len(emailer.sent) == 2
    assert all("https://meet.google.com/test-room" in body for _, _, body in emailer.sent)

    # Second run does not duplicate
    summary_2 = run_scheduled_tasks(db_session, email_service=emailer)
    assert summary_2["reminders_sent"] == 0


def test_post_session_evaluation_lifecycle(db_session: Session):
    client, psych, admin, profile, service = _seed_base(db_session)
    CmsUsecase(db_session).update_cms(
        CmsContentUpdate(
            vision="Accessible care across the Philippines.",
            mission="Structured compassionate mental health care.",
            clinic_overview="PsychAve connects clients with PRC psychologists.",
            impact_narrative="Client-first scheduling protects boundaries.",
            evaluation_form_url="https://docs.google.com/forms/d/e/test/viewform",
        )
    )
    appt = Appointment(
        profile_id=profile.profile_id,
        service_id=service.service_id,
        psychologist_id=psych.user_id,
        price=1500.0,
        presenting_concern="Anxiety",
        status=AppointmentStatus.CONFIRMED,
    )
    db_session.add(appt)
    db_session.commit()

    emailer = _RecordingEmailService()
    PsychologistUsecase(db_session, email_service=emailer).complete_appointment(
        appt.appointment_id, psych.user_id
    )
    assert len(emailer.sent) == 1
    assert emailer.sent[0][0] == "client@example.com"
    assert "https://docs.google.com/forms/d/e/test/viewform" in emailer.sent[0][2]

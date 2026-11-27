import uuid
from datetime import date
import pytest
from pydantic import ValidationError as PydanticValidationError
from sqlmodel import SQLModel, Session, create_engine
from sqlmodel.pool import StaticPool

from common.exceptions import BadRequestError
from models.appointment import Appointment, AppointmentStatus
from models.client_profile import ClientProfile
from models.profile import Profile, ProfileRelation
from models.psychologist_profile import PsychologistProfile
from models.service import Service
from models.user import User, UserRole
from repo.appointment_repo import AppointmentRepo
from schemas.appointment import MeetingLinkUpdate
from services.email.base import BaseEmailService
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


def _seed_appointment(db: Session, status: AppointmentStatus):
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
    )
    db.add(appt)
    db.commit()
    return appt, psych.user_id


def test_update_meeting_link_on_confirmed_appointment(db_session: Session):
    appt, psych_id = _seed_appointment(db_session, AppointmentStatus.CONFIRMED)
    email_svc = _RecordingEmailService()
    uc = PsychologistUsecase(db_session, email_service=email_svc)

    updated = uc.update_meeting_link(
        appt.appointment_id, psych_id, "https://meet.google.com/abc-defg-hij"
    )
    assert updated.meeting_link == "https://meet.google.com/abc-defg-hij"
    assert len(email_svc.sent) == 1
    assert email_svc.sent[0][0] == "client@example.com"
    assert "https://meet.google.com/abc-defg-hij" in email_svc.sent[0][2]


def test_update_meeting_link_rejects_unconfirmed_and_hides_in_read(db_session: Session):
    appt, psych_id = _seed_appointment(db_session, AppointmentStatus.AWAITING_PAYMENT)
    appt.meeting_link = "https://meet.google.com/should-not-leak"
    db_session.add(appt)
    db_session.commit()

    read = AppointmentRepo(db_session).build_read(appt)
    assert read.meeting_link is None

    uc = PsychologistUsecase(db_session, email_service=_RecordingEmailService())
    with pytest.raises(BadRequestError, match="confirmed appointments"):
        uc.update_meeting_link(
            appt.appointment_id, psych_id, "https://meet.google.com/abc-defg-hij"
        )


def test_meeting_link_schema_requires_https():
    with pytest.raises(PydanticValidationError):
        MeetingLinkUpdate(meeting_link="http://meet.google.com/insecure")
    with pytest.raises(PydanticValidationError):
        MeetingLinkUpdate(meeting_link="javascript:alert(1)")
    valid = MeetingLinkUpdate(meeting_link="  https://zoom.us/j/123456  ")
    assert valid.meeting_link == "https://zoom.us/j/123456"

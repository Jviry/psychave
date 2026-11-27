import uuid
from datetime import date
import pytest
from sqlmodel import SQLModel, Session, create_engine
from sqlmodel.pool import StaticPool

from common.exceptions import ForbiddenError
from models.appointment import Appointment, AppointmentStatus
from models.client_profile import ClientProfile
from models.forms import Forms
from models.profile import Profile, ProfileRelation
from models.user import User, UserRole
from repo.consent_template_repo import ConsentTemplateRepo
from usecase.profile_usecase import ProfileUsecase


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


def _seed_profile(db: Session) -> Profile:
    client = User(
        user_id=uuid.uuid4(),
        cognito_sub=f"sub-{uuid.uuid4()}",
        email="client@example.com",
        role=UserRole.CLIENT.value,
    )
    db.add(client)
    db.flush()
    db.add(ClientProfile(client_id=client.user_id, full_name="Client One"))
    profile = Profile(
        profile_id=uuid.uuid4(),
        client_id=client.user_id,
        relation_to_account_holder=ProfileRelation.self_,
        profile_name="Client One",
        date_of_birth=date(1995, 1, 1),
    )
    db.add(profile)
    db.flush()
    db.add(
        Forms(
            profile_id=profile.profile_id,
            consent_version="v2",
            responses={"terms_signer_name": "Client One"},
        )
    )
    db.commit()
    return profile


def test_psychologist_cannot_review_unrelated_profile(db_session: Session):
    profile = _seed_profile(db_session)
    uc = ProfileUsecase(db_session)
    with pytest.raises(ForbiddenError):
        uc.get_profile_for_psychologist(profile.profile_id, uuid.uuid4())


def test_psychologist_can_review_pending_profile(db_session: Session):
    profile = _seed_profile(db_session)
    db_session.add(
        Appointment(
            profile_id=profile.profile_id,
            service_id=uuid.uuid4(),
            presenting_concern="Initial consultation",
            status=AppointmentStatus.PENDING,
        )
    )
    db_session.commit()

    uc = ProfileUsecase(db_session)
    res = uc.get_profile_for_psychologist(profile.profile_id, uuid.uuid4())
    assert res["profile"].profile_id == profile.profile_id


def test_psychologist_can_review_assigned_profile_but_other_cannot(db_session: Session):
    profile = _seed_profile(db_session)
    assigned_psych = uuid.uuid4()
    other_psych = uuid.uuid4()
    db_session.add(
        Appointment(
            profile_id=profile.profile_id,
            service_id=uuid.uuid4(),
            presenting_concern="Initial consultation",
            psychologist_id=assigned_psych,
            status=AppointmentStatus.CONFIRMED,
        )
    )
    db_session.commit()

    uc = ProfileUsecase(db_session)
    res = uc.get_profile_for_psychologist(profile.profile_id, assigned_psych)
    assert res["profile"].profile_id == profile.profile_id

    with pytest.raises(ForbiddenError):
        uc.get_profile_for_psychologist(profile.profile_id, other_psych)

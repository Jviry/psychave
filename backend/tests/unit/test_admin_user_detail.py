from datetime import date
import uuid

import pytest
from sqlmodel import Session, SQLModel, create_engine

from common.exceptions import NotFoundError
from models.client_profile import ClientProfile
from models.profile import Profile, ProfileRelation
from models.psychologist_profile import PsychologistProfile
from models.user import User, UserRole
from services.auth.fake_service import FakeAuthService
from usecase.admin_usecase import AdminUsecase


def _make_session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(engine)
    return Session(engine)


def test_list_users_includes_resolved_username():
    db = _make_session()
    auth = FakeAuthService()
    auth.users_by_username["maria_client"] = {
        "username": "maria_client",
        "email": "maria@example.com",
        "sub": "sub-maria",
        "groups": ["client"],
    }

    user = User(
        cognito_sub="sub-maria",
        email="maria@example.com",
        role=UserRole.CLIENT.value,
    )
    db.add(user)
    db.commit()

    page = AdminUsecase(auth, db).list_users(None, None, 1, 10)
    assert page.total == 1
    assert page.items[0].username == "maria_client"
    assert page.items[0].email == "maria@example.com"


def test_get_user_detail_returns_client_and_psychologist_profiles():
    db = _make_session()
    auth = FakeAuthService()
    auth.users_by_username["dr_santos"] = {
        "username": "dr_santos",
        "email": "dr.santos@example.com",
        "sub": "sub-santos",
        "groups": ["psychologist"],
    }

    psych = User(
        cognito_sub="sub-santos",
        email="dr.santos@example.com",
        role=UserRole.PSYCHOLOGIST.value,
    )
    db.add(psych)
    db.flush()
    db.add(
        PsychologistProfile(
            psychologist_id=psych.user_id,
            full_name="Dr. Ana Santos",
            license_number="PRC-12345",
            specialization="Clinical Psychology",
            bio="Experienced therapist.",
            social_media_links=[
                {"platform": "LinkedIn", "url": "https://linkedin.com/in/anas"}
            ],
        )
    )

    client = User(
        cognito_sub="sub-juan",
        email="juan@example.com",
        role=UserRole.CLIENT.value,
    )
    db.add(client)
    db.flush()
    db.add(ClientProfile(client_id=client.user_id))
    db.add(
        Profile(
            client_id=client.user_id,
            relation_to_account_holder=ProfileRelation.self_,
            profile_name="Juan Dela Cruz",
            date_of_birth=date(1995, 5, 12),
            socmed_platform="Instagram",
            socmed_username="@juandc",
        )
    )
    db.commit()

    uc = AdminUsecase(auth, db)

    psych_detail = uc.get_user_detail(psych.user_id)
    assert psych_detail.username == "dr_santos"
    assert psych_detail.psychologist_profile is not None
    assert psych_detail.psychologist_profile.license_number == "PRC-12345"
    assert len(psych_detail.psychologist_profile.social_media_links) == 1

    client_detail = uc.get_user_detail(client.user_id)
    assert client_detail.username is None
    assert client_detail.psychologist_profile is None
    assert len(client_detail.client_profiles) == 1
    assert client_detail.client_profiles[0].profile_name == "Juan Dela Cruz"


def test_get_user_detail_raises_not_found():
    db = _make_session()
    uc = AdminUsecase(FakeAuthService(), db)
    with pytest.raises(NotFoundError):
        uc.get_user_detail(uuid.uuid4())

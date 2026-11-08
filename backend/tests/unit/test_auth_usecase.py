import pytest
from sqlmodel import SQLModel, Session, create_engine, select
from sqlmodel.pool import StaticPool

from common.exceptions import ValidationError
from models.admin_profile import AdminProfile
from models.client_profile import ClientProfile
from models.psychologist_profile import PsychologistProfile
from models.user import User, UserRole
from schemas.auth_model import (
    ConfirmUserRequest,
    ForgotPasswordConfirm,
    UserCreate,
    UserLogin,
)
from services.auth.fake_service import FakeAuthService
from usecase.auth_usecase import AuthUsecase


@pytest.fixture
def session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as s:
        yield s


@pytest.fixture
def fake_auth():
    return FakeAuthService()


@pytest.fixture
def auth_usecase(fake_auth, session):
    return AuthUsecase(service=fake_auth, db=session)


def test_create_user_client_success(auth_usecase, fake_auth, session):
    creds = UserCreate(
        username="johndoe",
        email="john@example.com",
        password="Password123!",
        role=UserRole.CLIENT,
    )
    res = auth_usecase.create_user(creds)
    assert res == {"message": "register successful, check email for code"}

    # verify user and client profile exist in db
    user = session.exec(select(User).where(User.email == "john@example.com")).first()
    assert user is not None
    assert user.role == UserRole.CLIENT.value
    assert session.get(ClientProfile, user.user_id) is not None

    # verify group added in auth service
    assert fake_auth.list_user_groups("johndoe") == ["client"]


def test_create_user_always_creates_client_role(auth_usecase, session):
    creds = UserCreate(
        username="admin1",
        email="admin@example.com",
        password="Password123!",
    )
    auth_usecase.create_user(creds)
    user = session.exec(select(User).where(User.email == "admin@example.com")).first()
    assert user is not None
    assert user.role == UserRole.CLIENT.value


def test_login_and_refresh_token(auth_usecase, fake_auth):
    creds = UserCreate(
        username="testlogin",
        email="testlogin@example.com",
        password="Password123!",
        role=UserRole.CLIENT,
    )
    auth_usecase.create_user(creds)

    login_creds = UserLogin(username="testlogin", password="Password123!")
    tokens = auth_usecase.login_user(login_creds)

    assert tokens.access_token is not None
    assert tokens.id_token is not None
    assert tokens.refresh_token is not None

    # Test refresh
    refreshed = auth_usecase.refresh_access_token(tokens.refresh_token)
    assert refreshed.access_token is not None


def test_confirm_user_and_sync(auth_usecase, fake_auth, session):
    creds = UserCreate(
        username="confirmuser",
        email="confirm@example.com",
        password="Password123!",
        role=UserRole.CLIENT,
    )
    fake_auth.create_user(creds)
    fake_auth.add_user_to_group("confirmuser", "client")

    auth_usecase.confirm_user(
        ConfirmUserRequest(username="confirmuser", confirmation_code="123456")
    )

    user = session.exec(select(User).where(User.email == "confirm@example.com")).first()
    assert user is not None
    assert session.get(ClientProfile, user.user_id) is not None


def test_forgot_password_flow(auth_usecase, fake_auth):
    creds = UserCreate(
        username="forgotuser",
        email="forgot@example.com",
        password="OldPassword123!",
        role=UserRole.CLIENT,
    )
    auth_usecase.create_user(creds)

    res1 = auth_usecase.request_forgot_password("forgotuser")
    assert res1 == {"message": "confirmation code sent to email"}

    res2 = auth_usecase.confirm_forgot_password(
        ForgotPasswordConfirm(
            username="forgotuser",
            confirmation_code="654321",
            new_password="NewPassword123!",
        )
    )
    assert res2 == {"message": "password change successful"}

    # Should be able to login with new password
    tokens = auth_usecase.login_user(
        UserLogin(username="forgotuser", password="NewPassword123!")
    )
    assert tokens.access_token is not None


def test_logout(auth_usecase, fake_auth):
    creds = UserCreate(
        username="logoutuser",
        email="logout@example.com",
        password="Password123!",
        role=UserRole.CLIENT,
    )
    auth_usecase.create_user(creds)

    tokens = auth_usecase.login_user(
        UserLogin(username="logoutuser", password="Password123!")
    )
    logout_res = auth_usecase.logout_user(tokens.access_token)
    assert logout_res == {"message": "logout successful"}


def test_delete_user(auth_usecase, fake_auth):
    creds = UserCreate(
        username="deleteuser",
        email="delete@example.com",
        password="Password123!",
        role=UserRole.CLIENT,
    )
    auth_usecase.create_user(creds)

    tokens = auth_usecase.login_user(
        UserLogin(username="deleteuser", password="Password123!")
    )
    del_res = auth_usecase.delete_user(tokens.access_token)
    assert del_res == {"message": "delete user successful"}

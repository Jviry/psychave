from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
from sqlmodel import SQLModel, Session, create_engine
from sqlmodel.pool import StaticPool

from common.database import get_db
from controllers.auth_controller import router as auth_router
from dependencies.auth import get_auth_service
from services.auth.fake_service import FakeAuthService


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
def client(session, fake_auth):
    app = FastAPI()
    app.include_router(auth_router, prefix="/auth")

    app.dependency_overrides[get_db] = lambda: session
    app.dependency_overrides[get_auth_service] = lambda: fake_auth

    with TestClient(app) as test_client:
        yield test_client


def test_auth_controller_flow(client):
    # 1. Register user
    res = client.post(
        "/auth/create-user",
        json={
            "username": "apiuser",
            "email": "api@example.com",
            "password": "Password123!",
            "role": "client",
        },
    )
    assert res.status_code == 200
    assert res.json() == {"message": "register successful, check email for code"}

    # 2. Confirm user
    res = client.post(
        "/auth/confirm",
        json={"username": "apiuser", "confirmation_code": "123456"},
    )
    assert res.status_code == 200
    assert res.json() == {"message": "user confirmed"}

    # 3. Login user
    res = client.post(
        "/auth/login",
        json={"username": "apiuser", "password": "Password123!"},
    )
    assert res.status_code == 200
    tokens = res.json()
    assert "AccessToken" in tokens
    assert "IdToken" in tokens
    assert "RefreshToken" in tokens

    # 4. Refresh token
    res = client.post(
        f"/auth/refresh-token?refresh_token={tokens['RefreshToken']}"
    )
    assert res.status_code == 200
    refreshed = res.json()
    assert "AccessToken" in refreshed

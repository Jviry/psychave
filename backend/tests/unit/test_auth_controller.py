from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest
from sqlmodel import SQLModel, Session, create_engine
from sqlmodel.pool import StaticPool

from common.exceptions import DomainError, RateLimitError, UserNotConfirmedError
from common.database import get_db
from common.rate_limit import verification_rate_limiter
from controllers.auth_controller import router as auth_router
from dependencies.auth import get_auth_service
from fastapi.responses import JSONResponse
from services.auth.fake_service import FakeAuthService


@pytest.fixture(autouse=True)
def clear_rate_limiter():
    verification_rate_limiter.clear_all()
    yield
    verification_rate_limiter.clear_all()


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

    @app.exception_handler(DomainError)
    async def domain_error_handler(_, exc: DomainError):
        if isinstance(exc, UserNotConfirmedError):
            return JSONResponse(
                status_code=exc.status_code,
                content={"detail": exc.detail, "code": exc.code},
            )
        if isinstance(exc, RateLimitError):
            headers = (
                {"Retry-After": str(exc.retry_after)}
                if exc.retry_after is not None
                else None
            )
            return JSONResponse(
                status_code=exc.status_code,
                content={"detail": exc.detail},
                headers=headers,
            )
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

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
            "profile": {
                "relation_to_account_holder": "self",
                "profile_name": "Api User",
                "date_of_birth": "1994-08-12",
                "nationality": "Filipino",
                "permanent_address": "Block 1 Lot 2, Makati City",
                "present_address": "Unit 12B, Taguig City",
                "contact_number": "+639171234567",
                "preferred_contact_mode": "email",
                "emergency_contact_name": "Emergency Contact",
                "emergency_contact_relation": "Spouse",
                "emergency_contact_number": "+639187654321",
            },
            "consent": {
                "consent_version": "v2",
                "terms_agreed": True,
                "terms_signer_relation": "self",
                "scope_acknowledged": True,
                "information_confirmed": True,
                "is_overseas_or_foreign": False,
                "overseas_acknowledged": False,
            },
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
        "/auth/refresh-token",
        json={"refresh_token": tokens["RefreshToken"]},
    )
    assert res.status_code == 200
    refreshed = res.json()
    assert "AccessToken" in refreshed


def test_unverified_login_recovery_and_rate_limiting(client):
    # 1. Register user (unconfirmed)
    reg_res = client.post(
        "/auth/create-user",
        json={
            "username": "recoveruser",
            "email": "recover@example.com",
            "password": "Password123!",
            "profile": {
                "relation_to_account_holder": "self",
                "profile_name": "Recover User",
                "date_of_birth": "1994-08-12",
                "nationality": "Filipino",
                "permanent_address": "Block 1 Lot 2, Makati City",
                "present_address": "Unit 12B, Taguig City",
                "contact_number": "+639171234567",
                "preferred_contact_mode": "email",
                "emergency_contact_name": "Emergency Contact",
                "emergency_contact_relation": "Spouse",
                "emergency_contact_number": "+639187654321",
            },
            "consent": {
                "consent_version": "v2",
                "terms_agreed": True,
                "terms_signer_relation": "self",
                "scope_acknowledged": True,
                "information_confirmed": True,
                "is_overseas_or_foreign": False,
                "overseas_acknowledged": False,
            },
        },
    )
    assert reg_res.status_code == 200

    # 2. Login with wrong password still returns 403 USER_NOT_CONFIRMED & no tokens
    login_res = client.post(
        "/auth/login",
        json={"username": "recoveruser", "password": "WrongPassword!"},
    )
    assert login_res.status_code == 403
    body = login_res.json()
    assert body["code"] == "USER_NOT_CONFIRMED"
    assert "AccessToken" not in body
    assert "recover@example.com" not in str(body)

    # 3. Resend code succeeds, immediate retry returns 429 with Retry-After
    resend_res = client.post("/auth/resend-code?username=recoveruser")
    assert resend_res.status_code == 200
    assert resend_res.json() == {"message": "confirmation code sent"}

    resend_429 = client.post("/auth/resend-code?username=recoveruser")
    assert resend_429.status_code == 429
    assert "Retry-After" in resend_429.headers

    # 4. Confirm user & login succeeds
    confirm_res = client.post(
        "/auth/confirm",
        json={"username": "recoveruser", "confirmation_code": "123456"},
    )
    assert confirm_res.status_code == 200

    ok_login = client.post(
        "/auth/login",
        json={"username": "recoveruser", "password": "Password123!"},
    )
    assert ok_login.status_code == 200
    assert "AccessToken" in ok_login.json()

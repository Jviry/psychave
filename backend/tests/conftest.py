import os
import uuid
from datetime import date, datetime, time, timezone
from typing import Callable, Any
import pytest
from sqlalchemy import create_engine, text
from sqlmodel import Session
from fastapi.testclient import TestClient

from models.user import User, UserRole
from models.admin_profile import AdminProfile
from models.psychologist_profile import PsychologistProfile
from models.client_profile import ClientProfile
from models.persona import Persona, PersonaRelation, ContactMode
from models.forms import Forms
from models.service import Service
from models.appointment import Appointment, AppointmentStatus
from models.proposed_slot import ProposedSlot
from models.payment import Payment, PaymentStatus

# Ensure required environment variables for testing
os.environ.setdefault("AWS_REGION", "ap-southeast-1")
os.environ.setdefault("COGNITO_USER_POOL_ID", "local-test-pool")
os.environ.setdefault("COGNITO_APP_CLIENT_ID", "local-test-client")
os.environ.setdefault("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:54322/postgres_test")
os.environ.setdefault("ENV", "development")
os.environ.setdefault("PAYMENT_PROVIDER", "fake")

BASE_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
TEST_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres_test"


@pytest.fixture(scope="session")
def ensure_test_database():
    """
    Ensure the postgres_test database exists on the local Supabase instance.
    If Supabase is offline:
      - When PYTEST_STRICT_INTEGRATION=1 is set (e.g., via 'make test-integration'),
        fails immediately with explicit instructions to run 'make db-start'.
      - Otherwise (e.g. general test runs), skips integration tests gracefully.
    """
    try:
        admin_engine = create_engine(BASE_DB_URL, pool_pre_ping=True)
        with admin_engine.connect().execution_options(isolation_level="AUTOCOMMIT") as conn:
            exists = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = 'postgres_test'")
            ).scalar()
            if not exists:
                conn.execute(text("CREATE DATABASE postgres_test"))
        admin_engine.dispose()
    except Exception as exc:
        is_strict = os.getenv("PYTEST_STRICT_INTEGRATION") == "1"
        err_msg = (
            f"Local Supabase PostgreSQL is not reachable at {BASE_DB_URL}: {exc}.\n"
            "Please start your local Supabase instance with:\n"
            "  make db-start\n"
            "or 'cd backend && npx supabase start'."
        )
        if is_strict:
            pytest.fail(err_msg)
        else:
            pytest.skip(f"Integration tests skipped: {err_msg}")


@pytest.fixture(scope="session")
def test_engine(ensure_test_database):
    """
    Session-scoped SQLAlchemy/SQLModel engine for the test database with schema initialized
    strictly via Alembic migrations ('alembic upgrade head').
    """
    from pathlib import Path
    import models  # noqa: F401 - ensure models are imported
    from alembic.config import Config
    from alembic import command

    backend_dir = Path(__file__).resolve().parent.parent
    alembic_ini_path = backend_dir / "alembic.ini"

    engine = create_engine(TEST_DB_URL, pool_pre_ping=True)

    # Strictly run Alembic migrations on postgres_test to guarantee parity with production schema
    alembic_cfg = Config(str(alembic_ini_path))
    alembic_cfg.set_main_option("script_location", str(backend_dir / "alembic"))
    alembic_cfg.set_main_option("sqlalchemy.url", TEST_DB_URL)
    command.upgrade(alembic_cfg, "head")

    yield engine
    engine.dispose()


@pytest.fixture
def db_session(test_engine):
    """
    Function-scoped database session wrapped inside an outer transaction.
    At the end of each test, the transaction is rolled back, leaving the database pristine.
    """
    connection = test_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)

    yield session

    session.close()
    if transaction.is_active:
        transaction.rollback()
    connection.close()


@pytest.fixture
def client(db_session):
    """
    FastAPI TestClient with the database dependency overridden to use the transactional db_session.
    """
    from main import app
    from common.database import get_db

    app.dependency_overrides[get_db] = lambda: db_session

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def auth_override():
    """
    Helper fixture to override get_claims dependency for authenticated testing.
    Usage:
        def test_something(client, auth_override):
            auth_override(sub="user-sub", role="psychologist")
            res = client.get(...)
    """
    from main import app
    from dependencies.auth import get_claims

    def _set_auth(sub: str, role: str):
        app.dependency_overrides[get_claims] = lambda: {
            "sub": sub,
            "email": f"{role}@test.com",
            "cognito:groups": [role],
            "groups": [role],
        }

    yield _set_auth
    app.dependency_overrides.pop(get_claims, None)


# ==============================================================================
# Model Factory Fixtures (Clean transactional fixtures)
# ==============================================================================

@pytest.fixture
def create_user(db_session: Session) -> Callable[..., User]:
    def _create(
        role: str = UserRole.CLIENT.value,
        email: str | None = None,
        sub: str | None = None,
    ) -> User:
        user_id = uuid.uuid4()
        user = User(
            user_id=user_id,
            cognito_sub=sub or f"sub-{user_id}",
            email=email or f"user-{user_id[:8] if isinstance(user_id, str) else str(user_id)[:8]}@test.com",
            role=role,
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    return _create


@pytest.fixture
def create_client_user(create_user, db_session: Session) -> Callable[..., tuple[User, ClientProfile]]:
    def _create(email: str | None = None, sub: str | None = None) -> tuple[User, ClientProfile]:
        user = create_user(role=UserRole.CLIENT.value, email=email, sub=sub)
        client_profile = ClientProfile(client_id=user.user_id)
        db_session.add(client_profile)
        db_session.commit()
        db_session.refresh(client_profile)
        return user, client_profile

    return _create


@pytest.fixture
def create_admin_user(create_user, db_session: Session) -> Callable[..., tuple[User, AdminProfile]]:
    def _create(
        full_name: str = "Admin Test",
        email: str | None = None,
        sub: str | None = None,
    ) -> tuple[User, AdminProfile]:
        user = create_user(role=UserRole.ADMIN.value, email=email, sub=sub)
        admin_profile = AdminProfile(admin_id=user.user_id, full_name=full_name)
        db_session.add(admin_profile)
        db_session.commit()
        db_session.refresh(admin_profile)
        return user, admin_profile

    return _create


@pytest.fixture
def create_psychologist_user(
    create_user, db_session: Session
) -> Callable[..., tuple[User, PsychologistProfile]]:
    def _create(
        full_name: str = "Dr. Test Psychologist",
        license_number: str = "RPSY-99999",
        specialization: str = "Clinical Psychology",
        bio: str = "Test bio",
        approval_status: str = "approved",
        approved_by: uuid.UUID | None = None,
        email: str | None = None,
        sub: str | None = None,
    ) -> tuple[User, PsychologistProfile]:
        user = create_user(role=UserRole.PSYCHOLOGIST.value, email=email, sub=sub)
        psych_profile = PsychologistProfile(
            psychologist_id=user.user_id,
            full_name=full_name,
            license_number=license_number,
            specialization=specialization,
            bio=bio,
            approval_status=approval_status,
            approved_by=approved_by,
            approved_at=datetime.now(timezone.utc) if approval_status == "approved" else None,
        )
        db_session.add(psych_profile)
        db_session.commit()
        db_session.refresh(psych_profile)
        return user, psych_profile

    return _create


@pytest.fixture
def create_service(db_session: Session) -> Callable[..., Service]:
    def _create(
        name: str = "Individual Therapy Session",
        description: str = "Standard 50-minute psychological therapy session",
        is_active: bool = True,
    ) -> Service:
        service = Service(
            service_id=uuid.uuid4(),
            name=name,
            description=description,
            is_active=is_active,
        )
        db_session.add(service)
        db_session.commit()
        db_session.refresh(service)
        return service

    return _create


@pytest.fixture
def create_persona(db_session: Session) -> Callable[..., Persona]:
    def _create(
        client_id: uuid.UUID,
        persona_name: str = "Juan Test Persona",
        relation: PersonaRelation = PersonaRelation.self_,
        preferred_contact_mode: ContactMode = ContactMode.email,
        contact_number: str = "+639171112222",
    ) -> Persona:
        persona = Persona(
            persona_id=uuid.uuid4(),
            client_id=client_id,
            relation_to_account_holder=relation,
            persona_name=persona_name,
            date_of_birth=date(1995, 5, 20),
            nationality="Filipino",
            permanent_address="123 Test St, Manila",
            present_address="456 Sample Ave, Quezon City",
            contact_number=contact_number,
            preferred_contact_mode=preferred_contact_mode,
            emergency_contact_name="Emergency Contact",
            emergency_contact_relation="Sibling",
            emergency_contact_number="+639189998888",
        )
        db_session.add(persona)
        db_session.commit()
        db_session.refresh(persona)
        return persona

    return _create


@pytest.fixture
def create_appointment(db_session: Session) -> Callable[..., Appointment]:
    def _create(
        persona_id: uuid.UUID,
        service_id: uuid.UUID,
        psychologist_id: uuid.UUID | None = None,
        price: float = 1500.0,
        status: AppointmentStatus = AppointmentStatus.PENDING,
        presenting_concern: str = "General anxiety and stress management",
    ) -> Appointment:
        appointment = Appointment(
            appointment_id=uuid.uuid4(),
            persona_id=persona_id,
            service_id=service_id,
            psychologist_id=psychologist_id,
            price=price,
            status=status,
            presenting_concern=presenting_concern,
        )
        db_session.add(appointment)
        db_session.commit()
        db_session.refresh(appointment)
        return appointment

    return _create


@pytest.fixture
def create_proposed_slot(db_session: Session) -> Callable[..., ProposedSlot]:
    def _create(
        appointment_id: uuid.UUID,
        session_date: date | None = None,
        start_time: time | None = None,
        end_time: time | None = None,
    ) -> ProposedSlot:
        slot = ProposedSlot(
            slot_id=uuid.uuid4(),
            appointment_id=appointment_id,
            session_date=session_date or date(2026, 11, 1),
            start_time=start_time or time(10, 0),
            end_time=end_time or time(11, 0),
        )
        db_session.add(slot)
        db_session.commit()
        db_session.refresh(slot)
        return slot

    return _create

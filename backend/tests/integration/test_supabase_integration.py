import uuid
import pytest
from sqlmodel import Session, select
from models.user import User, UserRole
from models.service import Service
from models.admin_profile import AdminProfile
from models.psychologist_profile import PsychologistProfile


def test_supabase_db_connection(db_session: Session):
    """Verify that db_session is connected to Postgres and can execute queries."""
    user_id = uuid.uuid4()
    sub = f"test-sub-{user_id}"
    user = User(
        user_id=user_id,
        cognito_sub=sub,
        email="test@example.com",
        role=UserRole.ADMIN.value,
    )
    db_session.add(user)
    db_session.commit()

    queried_user = db_session.exec(select(User).where(User.user_id == user_id)).first()
    assert queried_user is not None
    assert queried_user.email == "test@example.com"
    assert queried_user.cognito_sub == sub


def test_transactional_isolation_rollback(db_session: Session):
    """
    Verify that the previous test's user was rolled back
    and that this test has an isolated database state.
    """
    users = db_session.exec(select(User).where(User.email == "test@example.com")).all()
    assert len(users) == 0


def test_api_integration_with_supabase(client, db_session: Session, auth_override):
    """
    End-to-end API integration test:
    Creates a user and a service in the database, authenticates via auth_override,
    and calls the FastAPI endpoint GET /services/active.
    """
    # 1. Create a client user in DB
    user_id = uuid.uuid4()
    sub = f"sub-{user_id}"
    user = User(
        user_id=user_id,
        cognito_sub=sub,
        email="client.integration@test.com",
        role=UserRole.CLIENT.value,
    )
    db_session.add(user)

    # 2. Add an active service
    service_id = uuid.uuid4()
    service = Service(
        service_id=service_id,
        name="Supabase Integration Therapy",
        description="Testing end-to-end flow with local Supabase",
        is_active=True,
    )
    db_session.add(service)
    db_session.commit()

    # 3. Authenticate as the client
    auth_override(sub=sub, role=UserRole.CLIENT.value)

    # 4. Request active services
    response = client.get("/services/active")
    assert response.status_code == 200

    data = response.json()
    assert any(s["service_id"] == str(service_id) for s in data)
    matched = next(s for s in data if s["service_id"] == str(service_id))
    assert matched["name"] == "Supabase Integration Therapy"
    assert matched["description"] == "Testing end-to-end flow with local Supabase"

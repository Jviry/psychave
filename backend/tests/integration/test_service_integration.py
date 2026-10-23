import uuid
from sqlmodel import Session, select
from models.user import UserRole
from models.service import Service
from repo.service_repo import ServiceRepo


def test_list_active_services_filtering(client, auth_override, create_client_user, create_service):
    """Verify GET /services/active returns only active services from Supabase DB."""
    client_user, _ = create_client_user()
    active_service = create_service(
        name="Cognitive Behavioral Therapy",
        description="Active CBT session",
        is_active=True,
    )
    inactive_service = create_service(
        name="Archived Session Type",
        description="Inactive legacy service",
        is_active=False,
    )

    auth_override(sub=client_user.cognito_sub, role=UserRole.CLIENT.value)
    response = client.get("/services/active")
    assert response.status_code == 200

    items = response.json()
    item_ids = [item["service_id"] for item in items]
    assert str(active_service.service_id) in item_ids
    assert str(inactive_service.service_id) not in item_ids


def test_list_all_services(client, auth_override, create_admin_user, create_service):
    """Verify GET /services returns all services including inactive ones."""
    admin_user, _ = create_admin_user()
    s1 = create_service(name="Service Alpha", is_active=True)
    s2 = create_service(name="Service Beta", is_active=False)

    auth_override(sub=admin_user.cognito_sub, role=UserRole.ADMIN.value)
    response = client.get("/services")
    assert response.status_code == 200

    items = response.json()
    item_ids = [item["service_id"] for item in items]
    assert str(s1.service_id) in item_ids
    assert str(s2.service_id) in item_ids


def test_service_repo_operations(db_session: Session, create_service):
    """Direct repository integration test against local Supabase PostgreSQL."""
    repo = ServiceRepo(db_session)
    s1 = create_service(name="Repo Test Active", is_active=True)
    s2 = create_service(name="Repo Test Inactive", is_active=False)

    all_services = repo.get_all()
    all_ids = [s.service_id for s in all_services]
    assert s1.service_id in all_ids
    assert s2.service_id in all_ids

    active_services = repo.get_all_active()
    active_ids = [s.service_id for s in active_services]
    assert s1.service_id in active_ids
    assert s2.service_id not in active_ids

    fetched = db_session.get(Service, s1.service_id)
    assert fetched is not None
    assert fetched.name == "Repo Test Active"

"""Unit and Postgres integration tests for the Full Multi-Page Wizard & Services CMS."""

from copy import deepcopy
from datetime import date, datetime, timedelta
from pathlib import Path
import subprocess
import sys
import uuid
from zoneinfo import ZoneInfo

from fastapi.testclient import TestClient
import pytest
from sqlalchemy import text
from sqlalchemy.exc import OperationalError
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine, select

from common.database import engine as pg_engine, get_db
from common.exceptions import ConflictError, ValidationError
from common.settings import settings
from dependencies.auth import get_claims, get_current_user
from main import app
from models.client_profile import ClientProfile
from models.consent_template import ConsentFormTemplate
from models.forms import Forms
from models.profile import ContactMode, Profile, ProfileRelation
from models.service import Service
from models.user import User, UserRole
from schemas.appointment import AppointmentCreate, SlotInput
from schemas.consent_template import (
    ConsentFormTemplateUpsert,
    WizardPageSchema,
)
from schemas.profile import ConsentCreate, ProfileCreate, ProfileWithConsentCreate
from schemas.service import ServiceCreate, ServiceUpdate
from seed_services import seed_services
from usecase.appointment_usecase import AppointmentUsecase
from usecase.consent_template_usecase import ConsentTemplateUsecase
from usecase.profile_usecase import ProfileUsecase
from usecase.service_usecase import ServiceUsecase

MANILA_TZ = ZoneInfo("Asia/Manila")


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def _make_user(session: Session, role: UserRole) -> User:
    user = User(
        user_id=uuid.uuid4(),
        cognito_sub=f"sub-{uuid.uuid4()}",
        email=f"{role.value}-{uuid.uuid4().hex[:6]}@example.com",
        role=role.value,
    )
    session.add(user)
    session.flush()
    if role == UserRole.CLIENT:
        session.add(ClientProfile(client_id=user.user_id))
    session.commit()
    session.refresh(user)
    return user


def _future_slots() -> list[SlotInput]:
    target = datetime.now(MANILA_TZ).date() + timedelta(days=5)
    return [
        SlotInput(session_date=target, start_time="09:00:00"),
        SlotInput(session_date=target, start_time="11:00:00"),
        SlotInput(session_date=target, start_time="14:00:00"),
    ]


def test_service_cms_usecase_crud_and_active_toggle(db_session: Session):
    uc = ServiceUsecase(db_session)

    created = uc.create_service(
        ServiceCreate(
            name="  Mindfulness Workshop  ",
            description="  Group mindfulness and stress reduction workshop.  ",
            duration_minutes=90,
            guardrail_notice="  Not a crisis intervention session.  ",
            is_active=True,
        )
    )
    assert created.name == "Mindfulness Workshop"
    assert created.duration_minutes == 90
    assert created.guardrail_notice == "Not a crisis intervention session."
    assert created.is_active is True

    assert len(uc.get_all_active()) == 1
    assert len(uc.get_all()) == 1

    updated = uc.update_service(
        created.service_id,
        ServiceUpdate(
            name="Advanced Mindfulness Workshop",
            duration_minutes=120,
            guardrail_notice="   ",
            is_active=False,
        ),
    )
    assert updated.name == "Advanced Mindfulness Workshop"
    assert updated.duration_minutes == 120
    assert updated.guardrail_notice is None
    assert updated.is_active is False

    assert len(uc.get_all_active()) == 0
    assert len(uc.get_all()) == 1


def test_wizard_cms_json_storage_minor_vs_major_versioning_and_resign(
    db_session: Session,
):
    forms_uc = ConsentTemplateUsecase(db_session)
    profile_uc = ProfileUsecase(db_session)
    service_uc = ServiceUsecase(db_session)
    appt_uc = AppointmentUsecase(db_session)
    client_user = _make_user(db_session, UserRole.CLIENT)

    service = service_uc.create_service(
        ServiceCreate(
            name="Individual Counseling",
            description="1-hour individual counseling session.",
            duration_minutes=60,
            is_active=True,
        )
    )

    # 1. Default lazy seed produces active v2 with 4 wizard pages
    active_v2 = forms_uc.get_active_template()
    assert active_v2.consent_version == "v2"
    assert len(active_v2.wizard_pages) == 4

    # 2. Client creates a dependent profile under v2 -> 5 core columns on Profile, rest in Profile.details & Forms.responses
    created_read = profile_uc.create_profile(
        ProfileWithConsentCreate(
            profile=ProfileCreate(
                relation_to_account_holder=ProfileRelation.child,
                profile_name="Juan Dela Cruz Jr.",
                date_of_birth=date(2015, 5, 15),
                socmed_platform="messenger",
                socmed_username="@juan.dc",
                occupation="Student",
                nationality="Filipino",
                permanent_address="Quezon City",
                present_address="Quezon City",
                contact_number="09171234567",
                preferred_contact_mode=ContactMode.messenger,
                emergency_contact_name="Juan Dela Cruz Sr.",
                emergency_contact_relation="Father",
                emergency_contact_number="09181234567",
            ),
            consent=ConsentCreate(
                consent_version="v2",
                terms_signer_name="Juan Dela Cruz Sr.",
                terms_signer_relation="parent",
                scope_acknowledged=True,
                is_overseas_or_foreign=False,
                overseas_acknowledged=False,
                information_confirmed=True,
                consent_signer_name="Juan Dela Cruz Sr.",
            ),
        ),
        client_user.user_id,
    )
    assert created_read.profile_name == "Juan Dela Cruz Jr."
    assert created_read.socmed_platform == "messenger"
    assert created_read.socmed_username == "@juan.dc"
    assert created_read.details["nationality"] == "Filipino"
    assert created_read.details["emergency_contact_name"] == "Juan Dela Cruz Sr."
    assert created_read.signed_consent_version == "v2"
    assert created_read.active_consent_version == "v2"
    assert created_read.consent_outdated is False

    # Verify DB rows directly: Profile has details JSON, Forms has responses JSON with frozen _review_sections
    db_profile = db_session.get(Profile, created_read.profile_id)
    assert db_profile is not None
    assert db_profile.details["contact_number"] == "09171234567"

    db_form = db_session.exec(
        select(Forms).where(Forms.profile_id == created_read.profile_id)
    ).first()
    assert db_form is not None
    assert db_form.responses["terms_signer_name"] == "Juan Dela Cruz Sr."
    assert isinstance(db_form.responses.get("_review_sections"), list)

    # Psychologist review returns labeled review_sections
    review = profile_uc.get_profile_for_psychologist(created_read.profile_id)
    assert len(review["review_sections"]) == 4
    step3_fields = {
        f.field_key: f.value for f in review["review_sections"][2].fields
    }
    assert step3_fields["profile_name"] == "Juan Dela Cruz Jr."
    assert step3_fields["socmed_username"] == "@juan.dc"

    # 3. Admin edits ONLY demographic fields on Step 3 (removes occupation, nationality, addresses,
    #    emergency contact; adds a custom demographic field "work_schedule")
    pages_demographic_edit = deepcopy(active_v2.wizard_pages)
    kept_step3_ids = {
        "profile_name",
        "date_of_birth",
        "contact_number",
        "socmed_platform",
        "socmed_username",
        "preferred_contact_mode",
    }
    pages_demographic_edit[2]["blocks"] = [
        b
        for b in pages_demographic_edit[2]["blocks"]
        if b["block_id"] in kept_step3_ids
    ]
    pages_demographic_edit[2]["blocks"].append(
        {
            "block_id": "work_schedule",
            "type": "select",
            "label": "Work or school schedule",
            "target": "profile",
            "field_key": "work_schedule",
            "applies_to": "all",
            "required": False,
            "options": [
                {"value": "day", "label": "Day shift"},
                {"value": "night", "label": "Night shift"},
            ],
            "show_if": None,
            "system_locked": False,
        }
    )

    updated_minor = forms_uc.update_active_template(
        ConsentFormTemplateUpsert(
            consent_version="v2",
            bump_type="auto",
            wizard_pages=[
                WizardPageSchema.model_validate(p)
                for p in pages_demographic_edit
            ],
        )
    )
    assert updated_minor.consent_version == "v2.1"

    # Existing profile signed under v2 is NOT marked consent_outdated under v2.1
    refreshed_profile = profile_uc.get_profile(
        created_read.profile_id, client_user.user_id
    )
    assert refreshed_profile.signed_consent_version == "v2"
    assert refreshed_profile.active_consent_version == "v2.1"
    assert refreshed_profile.consent_outdated is False

    # Client can edit their profile (PUT /profiles/{id}) without re-signing consent,
    # and partial details merge preserves existing details keys
    edited_profile = profile_uc.update_profile(
        created_read.profile_id,
        ProfileCreate(
            relation_to_account_holder=ProfileRelation.child,
            profile_name="Juan Dela Cruz II",
            date_of_birth=date(2015, 5, 15),
            contact_number="09179998888",
            preferred_contact_mode="messenger",
            details={"work_schedule": "day"},
        ),
        client_user.user_id,
    )
    assert edited_profile.profile_name == "Juan Dela Cruz II"
    assert edited_profile.details["contact_number"] == "09179998888"
    assert edited_profile.details["work_schedule"] == "day"
    assert edited_profile.details["nationality"] == "Filipino"
    assert edited_profile.consent_outdated is False

    # 4. Admin edits CONSENT (adds a new page with a required custom consent field and modifies consent text)
    pages_consent_edit = deepcopy(updated_minor.wizard_pages)
    pages_consent_edit[0]["blocks"][0]["content"] = (
        "UPDATED V3 INFORMED CONSENT AND TELEHEALTH AGREEMENT"
    )
    pages_consent_edit.append(
        {
            "page_id": "step-5-telehealth",
            "title": "Telehealth & intake questions",
            "description": "Additional clinical intake questions",
            "blocks": [
                {
                    "block_id": "previous_therapy",
                    "type": "select",
                    "label": "Have you attended therapy before?",
                    "target": "custom",
                    "field_key": "previous_therapy",
                    "applies_to": "all",
                    "required": True,
                    "options": [
                        {"value": "yes", "label": "Yes"},
                        {"value": "no", "label": "No"},
                    ],
                    "show_if": None,
                    "system_locked": False,
                },
                {
                    "block_id": "previous_therapist_notes",
                    "type": "textarea",
                    "label": "Briefly describe your previous therapy",
                    "target": "custom",
                    "field_key": "previous_therapist_notes",
                    "applies_to": "all",
                    "required": True,
                    "options": [],
                    "show_if": {
                        "field_key": "previous_therapy",
                        "equals": "yes",
                    },
                    "system_locked": False,
                },
                {
                    "block_id": "telehealth_consent_ack",
                    "type": "checkbox",
                    "label": "I consent to telehealth sessions.",
                    "target": "consent",
                    "field_key": "telehealth_consent_ack",
                    "applies_to": "all",
                    "required": True,
                    "options": [],
                    "show_if": None,
                    "system_locked": False,
                },
            ],
        }
    )

    updated_major = forms_uc.update_active_template(
        ConsentFormTemplateUpsert(
            consent_version="v2.1",
            bump_type="auto",
            wizard_pages=[
                WizardPageSchema.model_validate(p) for p in pages_consent_edit
            ],
        )
    )
    assert updated_major.consent_version == "v3"

    # Existing profile is now flagged as consent_outdated == True!
    outdated_profile = profile_uc.get_profile(
        created_read.profile_id, client_user.user_id
    )
    assert outdated_profile.signed_consent_version == "v2"
    assert outdated_profile.active_consent_version == "v3"
    assert outdated_profile.consent_outdated is True

    # Attempting to book an appointment while consent_outdated is True raises 409 ConflictError
    with pytest.raises(ConflictError, match="please re-sign version v3"):
        appt_uc.create_appointment(
            AppointmentCreate(
                profile_id=created_read.profile_id,
                service_id=service.service_id,
                presenting_concern="Managing school stress and sleep patterns.",
                preferred_slots=_future_slots(),
            ),
            client_user.user_id,
        )

    # Re-signing consent fails if conditional required custom field is missing
    with pytest.raises(ValidationError, match="previous_therapist_notes"):
        profile_uc.resign_consent(
            created_read.profile_id,
            ConsentCreate(
                consent_version="v3",
                terms_signer_name="Juan Dela Cruz Sr.",
                terms_signer_relation="parent",
                scope_acknowledged=True,
                is_overseas_or_foreign=False,
                overseas_acknowledged=False,
                information_confirmed=True,
                consent_signer_name="Juan Dela Cruz Sr.",
                responses={
                    "previous_therapy": "yes",
                    "telehealth_consent_ack": True,
                },
            ),
            client_user.user_id,
        )

    # Re-signing consent with all required v3 fields clears consent_outdated and unblocks booking
    resigned_profile = profile_uc.resign_consent(
        created_read.profile_id,
        ConsentCreate(
            consent_version="v3",
            terms_signer_name="Juan Dela Cruz Sr.",
            terms_signer_relation="parent",
            scope_acknowledged=True,
            is_overseas_or_foreign=False,
            overseas_acknowledged=False,
            information_confirmed=True,
            consent_signer_name="Juan Dela Cruz Sr.",
            responses={
                "previous_therapy": "yes",
                "previous_therapist_notes": "6 months of CBT in 2024.",
                "telehealth_consent_ack": True,
            },
        ),
        client_user.user_id,
    )
    assert resigned_profile.signed_consent_version == "v3"
    assert resigned_profile.consent_outdated is False

    created_appt = appt_uc.create_appointment(
        AppointmentCreate(
            profile_id=created_read.profile_id,
            service_id=service.service_id,
            presenting_concern="Managing school stress and sleep patterns.",
            preferred_slots=_future_slots(),
        ),
        client_user.user_id,
    )
    assert created_appt.profile_id == created_read.profile_id
    assert created_appt.profile_socmed_platform == "messenger"
    assert created_appt.profile_socmed_username == "@juan.dc"


def test_removing_locked_operational_field_is_rejected():
    active_pages = ConsentFormTemplate().wizard_pages
    broken_pages = deepcopy(active_pages)
    broken_pages[2]["blocks"] = [
        b
        for b in broken_pages[2]["blocks"]
        if b.get("field_key") != "socmed_username"
    ]
    with pytest.raises(ValueError, match="socmed_username"):
        ConsentFormTemplateUpsert(
            consent_version="v3",
            wizard_pages=[
                WizardPageSchema.model_validate(p) for p in broken_pages
            ],
        )


def test_http_endpoints_and_admin_role_guardrails(db_session: Session):
    admin_user = _make_user(db_session, UserRole.ADMIN)
    client_user = _make_user(db_session, UserRole.CLIENT)

    current_actor = {"user": admin_user}
    app.dependency_overrides[get_db] = lambda: db_session
    app.dependency_overrides[get_claims] = lambda: {
        "sub": current_actor["user"].cognito_sub,
        "cognito:groups": [current_actor["user"].role],
    }
    app.dependency_overrides[get_current_user] = lambda: current_actor["user"]

    try:
        client = TestClient(app)

        res_active_form = client.get("/forms/active")
        assert res_active_form.status_code == 200
        form_data = res_active_form.json()
        assert form_data["consent_version"] == "v2"
        assert len(form_data["wizard_pages"]) == 4

        res_create_svc = client.post(
            "/services",
            json={
                "name": "Career Coaching",
                "description": "Structured career transition and executive coaching.",
                "duration_minutes": 60,
                "guardrail_notice": "Not a clinical psychotherapy session.",
                "is_active": True,
            },
        )
        assert res_create_svc.status_code == 200
        svc_id = res_create_svc.json()["service_id"]

        res_patch_svc = client.patch(
            f"/services/{svc_id}",
            json={"is_active": False, "duration_minutes": 45},
        )
        assert res_patch_svc.status_code == 200
        assert res_patch_svc.json()["is_active"] is False

        assert client.get("/services").json() == []
        assert len(client.get("/services/all").json()) == 1

        edited_pages = deepcopy(form_data["wizard_pages"])
        edited_pages[2]["title"] = "Client Demographics & Contact"
        res_put_minor = client.put(
            "/forms/active",
            json={
                "consent_version": "v2",
                "bump_type": "auto",
                "wizard_pages": edited_pages,
            },
        )
        assert res_put_minor.status_code == 200
        assert res_put_minor.json()["consent_version"] == "v2.1"

        # Switch actor to CLIENT -> admin endpoints return 403
        current_actor["user"] = client_user
        assert client.get("/services/all").status_code == 403
        assert (
            client.post(
                "/services",
                json={
                    "name": "Unauthorized Service",
                    "description": "Should fail",
                    "duration_minutes": 60,
                },
            ).status_code
            == 403
        )
        assert (
            client.patch(f"/services/{svc_id}", json={"is_active": True}).status_code
            == 403
        )
        assert client.get("/forms/templates").status_code == 403
        assert (
            client.put(
                "/forms/active",
                json={"consent_version": "v3", "wizard_pages": edited_pages},
            ).status_code
            == 403
        )
    finally:
        app.dependency_overrides.clear()


def test_postgres_migration_seed_and_api_integration():
    """Migrate psychave-pg to a7b8c9d0e1f2, run seed_services, and verify live API endpoints."""
    if not settings.DATABASE_URL:
        pytest.skip("DATABASE_URL not configured")

    try:
        with pg_engine.begin() as conn:
            ver_rows = conn.execute(
                text("SELECT version_num FROM alembic_version")
            ).fetchall()
            current_vers = {r[0] for r in ver_rows}
            if "a7b8c9d0e1f2" in current_vers:
                pass
    except OperationalError as exc:
        pytest.skip(f"Postgres server not reachable: {exc}")

    backend_dir = Path(__file__).resolve().parent.parent
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=backend_dir,
        check=True,
    )

    created_count, updated_count = seed_services()
    assert created_count + updated_count == 7

    with Session(pg_engine) as pg_session:
        admin_user = _make_user(pg_session, UserRole.ADMIN)
        client_user = _make_user(pg_session, UserRole.CLIENT)
        current_actor = {"user": admin_user}
        app.dependency_overrides[get_claims] = lambda: {
            "sub": current_actor["user"].cognito_sub,
            "cognito:groups": [current_actor["user"].role],
        }
        app.dependency_overrides[get_current_user] = lambda: current_actor["user"]

        created_service_id: uuid.UUID | None = None
        created_profile_id: uuid.UUID | None = None
        try:
            client = TestClient(app)

            res_public = client.get("/services")
            assert res_public.status_code == 200
            assert len(res_public.json()) >= 7

            res_form = client.get("/forms/active")
            assert res_form.status_code == 200
            active_form = res_form.json()
            assert active_form["consent_version"] == "v2"
            assert len(active_form["wizard_pages"]) == 4

            current_actor["user"] = client_user
            res_profile = client.post(
                "/profiles",
                json={
                    "profile": {
                        "relation_to_account_holder": "child",
                        "profile_name": "Maria Santos Jr.",
                        "date_of_birth": "2014-08-20",
                        "socmed_platform": "instagram",
                        "socmed_username": "@maria.santos",
                        "occupation": "Student",
                        "nationality": "Filipino",
                        "permanent_address": "Makati City",
                        "present_address": "Makati City",
                        "contact_number": "09171112222",
                        "preferred_contact_mode": "instagram",
                        "emergency_contact_name": "Jose Santos",
                        "emergency_contact_relation": "Father",
                        "emergency_contact_number": "09181112222",
                    },
                    "consent": {
                        "consent_version": "v2",
                        "terms_signer_name": "Jose Santos",
                        "terms_signer_relation": "parent",
                        "scope_acknowledged": True,
                        "is_overseas_or_foreign": False,
                        "overseas_acknowledged": False,
                        "information_confirmed": True,
                        "consent_signer_name": "Jose Santos",
                    },
                },
            )
            assert res_profile.status_code == 200, res_profile.text
            profile_json = res_profile.json()
            created_profile_id = uuid.UUID(profile_json["profile_id"])
            assert profile_json["details"]["occupation"] == "Student"
            assert profile_json["socmed_username"] == "@maria.santos"
            assert profile_json["consent_outdated"] is False

            current_actor["user"] = admin_user
            res_create = client.post(
                "/services",
                json={
                    "name": "Temp CMS Verification Service",
                    "description": "Temporary service created during Postgres API test.",
                    "duration_minutes": 75,
                    "guardrail_notice": "Test guardrail notice.",
                    "is_active": True,
                },
            )
            assert res_create.status_code == 200
            created_service_id = uuid.UUID(res_create.json()["service_id"])

            res_patch = client.patch(
                f"/services/{created_service_id}",
                json={"is_active": False},
            )
            assert res_patch.status_code == 200
            assert res_patch.json()["is_active"] is False
        finally:
            app.dependency_overrides.clear()
            if created_profile_id is not None:
                ProfileUsecase(pg_session).delete_profile(
                    created_profile_id, client_user.user_id
                )
            if created_service_id is not None:
                svc_row = pg_session.get(Service, created_service_id)
                if svc_row is not None:
                    pg_session.delete(svc_row)
            for u in (client_user, admin_user):
                cp = pg_session.get(ClientProfile, u.user_id)
                if cp is not None:
                    pg_session.delete(cp)
                pg_session.commit()
                user_row = pg_session.get(User, u.user_id)
                if user_row is not None:
                    pg_session.delete(user_row)
            pg_session.commit()

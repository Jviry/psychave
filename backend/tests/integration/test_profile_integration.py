import uuid
from sqlmodel import Session, select
from models.user import UserRole
from models.profile import Profile, ProfileRelation, ContactMode
from models.forms import Forms


def test_create_and_fetch_profile_with_consent(client, auth_override, db_session: Session, create_client_user):
    """
    End-to-end integration test creating a profile with consent form in Supabase.
    Verifies relational persistence in both 'profiles' and 'forms' tables.
    """
    client_user, _ = create_client_user()
    auth_override(sub=client_user.cognito_sub, role=UserRole.CLIENT.value)

    payload = {
        "profile": {
            "relation_to_account_holder": "child",
            "profile_name": "Maria Santos",
            "date_of_birth": "2014-08-12",
            "nationality": "Filipino",
            "permanent_address": "Block 1 Lot 2, Makati City",
            "present_address": "Unit 12B, Taguig City",
            "contact_number": "+639171234567",
            "preferred_contact_mode": "email",
            "emergency_contact_name": "Pedro Santos",
            "emergency_contact_relation": "Parent",
            "emergency_contact_number": "+639187654321",
        },
        "consent": {
            "consent_version": "v2",
            "terms_agreed": True,
            "terms_signer_relation": "parent",
            "scope_acknowledged": True,
            "information_confirmed": True,
            "is_overseas_or_foreign": False,
            "overseas_acknowledged": False,
        },
    }

    response = client.post("/profiles", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()
    profile_id = uuid.UUID(data["profile_id"])
    assert data["profile_name"] == "Maria Santos"

    # Verify both profile and form exist in Supabase DB
    db_profile = db_session.exec(select(Profile).where(Profile.profile_id == profile_id)).first()
    assert db_profile is not None
    assert db_profile.client_id == client_user.user_id
    assert db_profile.relation_to_account_holder == ProfileRelation.child

    db_form = db_session.exec(select(Forms).where(Forms.profile_id == profile_id)).first()
    assert db_form is not None
    assert db_form.consent_version == "v2"
    assert db_form.terms_agreed is True

    # Verify creating a 'self' profile via POST /profiles is blocked
    self_payload = {
        **payload,
        "profile": {
            **payload["profile"],
            "relation_to_account_holder": "self",
            "date_of_birth": "1994-08-12",
        },
        "consent": {
            **payload["consent"],
            "terms_signer_relation": "self",
        },
    }
    self_res = client.post("/profiles", json=self_payload)
    assert self_res.status_code == 422

    # Test GET /profiles/{profile_id}
    get_res = client.get(f"/profiles/{profile_id}")
    assert get_res.status_code == 200
    assert get_res.json()["profile_name"] == "Maria Santos"

    # Test GET /profiles (list)
    list_res = client.get("/profiles")
    assert list_res.status_code == 200
    assert any(p["profile_id"] == str(profile_id) for p in list_res.json())


def test_self_profile_cannot_be_deleted(client, auth_override, create_client_user, create_profile):
    """Verify primary self-profile cannot be deleted."""
    client_user, _ = create_client_user()
    self_profile = create_profile(
        client_id=client_user.user_id,
        profile_name="Primary Self",
        relation=ProfileRelation.self_,
    )
    auth_override(sub=client_user.cognito_sub, role=UserRole.CLIENT.value)
    del_res = client.delete(f"/profiles/{self_profile.profile_id}")
    assert del_res.status_code == 409


def test_update_profile(client, auth_override, db_session: Session, create_client_user, create_profile):
    """Verify updating profile details persists changes to the database."""
    client_user, _ = create_client_user()
    profile = create_profile(client_id=client_user.user_id, profile_name="Original Name")

    auth_override(sub=client_user.cognito_sub, role=UserRole.CLIENT.value)
    update_payload = {
        "relation_to_account_holder": "self",
        "profile_name": "Updated Name",
        "date_of_birth": "1995-05-20",
        "nationality": "Filipino",
        "permanent_address": "123 Updated St",
        "present_address": "456 New St",
        "contact_number": "+639998887766",
        "preferred_contact_mode": "phone",
        "emergency_contact_name": "Updated Emergency Contact",
        "emergency_contact_relation": "Mother",
        "emergency_contact_number": "+639112223344",
    }

    res = client.put(f"/profiles/{profile.profile_id}", json=update_payload)
    assert res.status_code == 200
    assert res.json()["profile_name"] == "Updated Name"

    db_session.refresh(profile)
    assert profile.profile_name == "Updated Name"
    assert profile.contact_number == "+639998887766"


def test_client_isolation_access_denied(client, auth_override, create_client_user, create_profile):
    """Verify Client A cannot view or manipulate Client B's profiles."""
    client_a, _ = create_client_user()
    client_b, _ = create_client_user()

    profile_b = create_profile(client_id=client_b.user_id, profile_name="Client B Profile")

    # Authenticate as Client A and try to access Client B's profile
    auth_override(sub=client_a.cognito_sub, role=UserRole.CLIENT.value)
    res = client.get(f"/profiles/{profile_b.profile_id}")
    assert res.status_code == 404

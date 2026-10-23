import uuid
from sqlmodel import Session, select
from models.user import UserRole
from models.persona import Persona, PersonaRelation, ContactMode
from models.forms import Forms


def test_create_and_fetch_persona_with_consent(client, auth_override, db_session: Session, create_client_user):
    """
    End-to-end integration test creating a persona with consent form in Supabase.
    Verifies relational persistence in both 'persona' and 'forms' tables.
    """
    client_user, _ = create_client_user()
    auth_override(sub=client_user.cognito_sub, role=UserRole.CLIENT.value)

    payload = {
        "persona": {
            "relation_to_account_holder": "self",
            "persona_name": "Maria Santos",
            "date_of_birth": "1994-08-12",
            "nationality": "Filipino",
            "permanent_address": "Block 1 Lot 2, Makati City",
            "present_address": "Unit 12B, Taguig City",
            "contact_number": "+639171234567",
            "preferred_contact_mode": "email",
            "emergency_contact_name": "Pedro Santos",
            "emergency_contact_relation": "Spouse",
            "emergency_contact_number": "+639187654321",
        },
        "consent": {
            "consent_version": "v1",
            "terms_signer_name": "Maria Santos",
            "terms_signer_relation": "self",
            "scope_acknowledged": True,
            "information_confirmed": True,
            "consent_signer_name": "Maria Santos",
            "is_overseas_or_foreign": False,
            "overseas_acknowledged": False,
        },
    }

    response = client.post("/personas", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()
    persona_id = uuid.UUID(data["persona_id"])
    assert data["persona_name"] == "Maria Santos"

    # Verify both persona and form exist in Supabase DB
    db_persona = db_session.exec(select(Persona).where(Persona.persona_id == persona_id)).first()
    assert db_persona is not None
    assert db_persona.client_id == client_user.user_id
    assert db_persona.relation_to_account_holder == PersonaRelation.self_

    db_form = db_session.exec(select(Forms).where(Forms.persona_id == persona_id)).first()
    assert db_form is not None
    assert db_form.consent_version == "v1"
    assert db_form.terms_signer_name == "Maria Santos"

    # Test GET /personas/{persona_id}
    get_res = client.get(f"/personas/{persona_id}")
    assert get_res.status_code == 200
    assert get_res.json()["persona_name"] == "Maria Santos"

    # Test GET /personas (list)
    list_res = client.get("/personas")
    assert list_res.status_code == 200
    assert any(p["persona_id"] == str(persona_id) for p in list_res.json())


def test_update_persona(client, auth_override, db_session: Session, create_client_user, create_persona):
    """Verify updating persona details persists changes to the database."""
    client_user, _ = create_client_user()
    persona = create_persona(client_id=client_user.user_id, persona_name="Original Name")

    auth_override(sub=client_user.cognito_sub, role=UserRole.CLIENT.value)
    update_payload = {
        "relation_to_account_holder": "self",
        "persona_name": "Updated Name",
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

    res = client.put(f"/personas/{persona.persona_id}", json=update_payload)
    assert res.status_code == 200
    assert res.json()["persona_name"] == "Updated Name"

    db_session.refresh(persona)
    assert persona.persona_name == "Updated Name"
    assert persona.contact_number == "+639998887766"


def test_client_isolation_access_denied(client, auth_override, create_client_user, create_persona):
    """Verify Client A cannot view or manipulate Client B's personas."""
    client_a, _ = create_client_user()
    client_b, _ = create_client_user()

    persona_b = create_persona(client_id=client_b.user_id, persona_name="Client B Persona")

    # Authenticate as Client A and try to access Client B's persona
    auth_override(sub=client_a.cognito_sub, role=UserRole.CLIENT.value)
    res = client.get(f"/personas/{persona_b.persona_id}")
    assert res.status_code == 404

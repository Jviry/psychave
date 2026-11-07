"""Fixtures for end-to-end tests against a deployed PR ephemeral environment."""

from datetime import datetime, timedelta
import os
import time
import uuid
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
import httpx
import pytest

load_dotenv()

MANILA_TZ = ZoneInfo("Asia/Manila")


@pytest.fixture(scope="session")
def api_url() -> str:
    """Return the base API URL and wait for the gateway + Lambda to become ready."""
    raw_url = os.getenv("API_URL", "http://localhost:8000")
    url = raw_url.rstrip("/")

    max_retries = 10
    delay = 2
    for _ in range(max_retries):
        try:
            response = httpx.get(f"{url}/health", timeout=5)
            if response.status_code == 200:
                return url
        except httpx.HTTPError:
            pass
        time.sleep(delay)

    pytest.fail(
        f"API at {url} did not become ready within {max_retries * delay} seconds."
    )


@pytest.fixture(scope="session")
def aws_region() -> str:
    return os.getenv("AWS_REGION", "ap-southeast-1")


@pytest.fixture(scope="session")
def cognito_user_pool_id() -> str:
    pool_id = os.getenv("COGNITO_USER_POOL_ID")
    if not pool_id:
        pytest.skip(
            "COGNITO_USER_POOL_ID is not set; skipping authenticated ephemeral tests"
        )
    return pool_id


@pytest.fixture(scope="session")
def cognito_client(aws_region: str):
    import boto3

    return boto3.client("cognito-idp", region_name=aws_region)


@pytest.fixture
def generate_user_credentials():
    """Generate unique Cognito credentials for per-test isolation."""

    def _generator() -> dict[str, str]:
        unique_id = uuid.uuid4().hex[:8]
        return {
            "email": f"ephemeral_{unique_id}@example.com",
            "username": f"ephem_{unique_id}",
            "password": "ValidPassword123!",
        }

    return _generator


@pytest.fixture
def authenticated_user_factory(
    api_url: str,
    cognito_client,
    cognito_user_pool_id: str,
    generate_user_credentials,
):
    """Create a confirmed Cognito user in ``role``, log in, and return auth headers.

    Assigning the Cognito group *before* ``POST /auth/login`` ensures:
    1. The minted ``IdToken`` includes ``cognito:groups: [role]``.
    2. ``AuthUsecase._ensure_local_user`` syncs the ``users`` row and role
       profile (``client_profiles`` / ``psychologist_profiles``) into the PR's
       isolated Postgres schema automatically.
    """
    created_usernames: list[str] = []

    def _create_and_login(role: str = "client") -> dict:
        creds = generate_user_credentials()
        username = creds["username"]
        email = creds["email"]
        password = creds["password"]

        cognito_client.admin_create_user(
            UserPoolId=cognito_user_pool_id,
            Username=username,
            UserAttributes=[
                {"Name": "email", "Value": email},
                {"Name": "email_verified", "Value": "true"},
                {"Name": "preferred_username", "Value": username},
            ],
            MessageAction="SUPPRESS",
        )
        created_usernames.append(username)

        cognito_client.admin_set_user_password(
            UserPoolId=cognito_user_pool_id,
            Username=username,
            Password=password,
            Permanent=True,
        )

        cognito_client.admin_add_user_to_group(
            UserPoolId=cognito_user_pool_id,
            Username=username,
            GroupName=role.lower(),
        )

        login_res = httpx.post(
            f"{api_url}/auth/login",
            json={"username": username, "password": password},
            timeout=15,
        )
        assert login_res.status_code == 200, (
            f"Failed to log in ephemeral {role} user: {login_res.text}"
        )
        tokens = login_res.json()
        id_token = tokens["IdToken"]

        return {
            **creds,
            "role": role.lower(),
            "access_token": tokens["AccessToken"],
            "id_token": id_token,
            "refresh_token": tokens.get("RefreshToken"),
            "auth_headers": {"Authorization": f"Bearer {id_token}"},
        }

    yield _create_and_login

    for username in created_usernames:
        try:
            cognito_client.admin_delete_user(
                UserPoolId=cognito_user_pool_id,
                Username=username,
            )
        except Exception:
            pass


@pytest.fixture
def create_client_persona(api_url: str):
    """Create a valid adult self-persona + consent for an authenticated client."""

    def _create(auth_headers: dict[str, str], name: str = "Juan Dela Cruz") -> dict:
        payload = {
            "persona": {
                "relation_to_account_holder": "self",
                "persona_name": name,
                "date_of_birth": "1996-05-15",
                "occupation": "Software Engineer",
                "nationality": "Filipino",
                "permanent_address": "Quezon City, Metro Manila",
                "present_address": "Quezon City, Metro Manila",
                "contact_number": "+639171234567",
                "socmed_platform": "Messenger",
                "socmed_username": "juan.delacruz.ephem",
                "preferred_contact_mode": "messenger",
                "emergency_contact_name": "Maria Dela Cruz",
                "emergency_contact_relation": "Mother",
                "emergency_contact_number": "+639181234567",
            },
            "consent": {
                "consent_version": "v2",
                "terms_signer_name": name,
                "terms_signer_relation": "self",
                "scope_acknowledged": True,
                "is_overseas_or_foreign": False,
                "overseas_acknowledged": False,
                "information_confirmed": True,
                "consent_signer_name": name,
            },
        }
        res = httpx.post(
            f"{api_url}/personas",
            headers=auth_headers,
            json=payload,
            timeout=15,
        )
        assert res.status_code == 200, f"Failed to create persona: {res.text}"
        return res.json()

    return _create


@pytest.fixture
def future_slot_inputs():
    """Return daytime ``Asia/Manila`` ``SlotInput`` dicts safe from midnight rollover."""

    def _build(
        days_ahead: int = 5,
        hours: tuple[str, ...] = ("09:00:00", "13:00:00", "15:30:00"),
    ) -> list[dict[str, str]]:
        target_date = (datetime.now(MANILA_TZ).date() + timedelta(days=days_ahead)).isoformat()
        return [
            {"session_date": target_date, "start_time": start_time}
            for start_time in hours
        ]

    return _build

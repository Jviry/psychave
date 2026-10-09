import os
import time
import uuid
import pytest
import requests
from dotenv import load_dotenv

load_dotenv()


@pytest.fixture(scope="session")
def api_url():
    """Returns the base API URL and ensures the service is ready."""
    raw_url = os.getenv("API_URL", "http://localhost:8000")
    url = raw_url.rstrip("/")

    # Light readiness check to handle cold start or initial gateway deployment
    max_retries = 10
    delay = 2
    is_ready = False

    for _ in range(max_retries):
        try:
            response = requests.get(f"{url}/health", timeout=5)
            if response.status_code == 200:
                is_ready = True
                break
        except requests.RequestException:
            pass
        time.sleep(delay)

    if not is_ready:
        pytest.fail(f"API at {url} did not become ready within {max_retries * delay} seconds.")

    return url


@pytest.fixture(scope="session")
def aws_region():
    return os.getenv("AWS_REGION", "ap-southeast-1")


@pytest.fixture(scope="session")
def cognito_user_pool_id():
    pool_id = os.getenv("COGNITO_USER_POOL_ID")
    if not pool_id:
        pytest.skip("COGNITO_USER_POOL_ID is not set; skipping tests requiring admin user creation")
    return pool_id


@pytest.fixture(scope="session")
def cognito_app_client_id():
    return os.getenv("COGNITO_APP_CLIENT_ID")


@pytest.fixture(scope="session")
def cognito_client(aws_region):
    import boto3
    return boto3.client("cognito-idp", region_name=aws_region)


@pytest.fixture
def generate_user_credentials():
    """Generates unique user credentials for test isolation."""
    def _generator():
        unique_id = uuid.uuid4().hex[:8]
        return {
            "email": f"test_{unique_id}@example.com",
            "username": f"user_{unique_id}",
            "password": "ValidPassword123!",
        }
    return _generator


@pytest.fixture
def registered_user(api_url, generate_user_credentials):
    """Creates a fresh unconfirmed user and returns the user credentials."""
    user_data = generate_user_credentials()
    response = requests.post(
        f"{api_url}/auth/create-user", json=user_data, timeout=10)
    assert response.status_code == 200, f"Failed to create fixture user: {response.text}"
    return user_data


@pytest.fixture
def admin_user_factory(cognito_client, cognito_user_pool_id, generate_user_credentials):
    """
    Factory fixture to create confirmed Cognito users with optional group/role,
    and automatically registers them for cleanup via admin_delete_user.
    """
    created_usernames = []

    def _create_user(role: str | None = None, password: str | None = None):
        creds = generate_user_credentials()
        if password:
            creds["password"] = password

        username = creds["username"]
        email = creds["email"]
        pwd = creds["password"]

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
            Password=pwd,
            Permanent=True,
        )

        if role:
            cognito_client.admin_add_user_to_group(
                UserPoolId=cognito_user_pool_id,
                Username=username,
                GroupName=role.lower(),
            )

        return creds

    yield _create_user

    for uname in created_usernames:
        try:
            cognito_client.admin_delete_user(
                UserPoolId=cognito_user_pool_id,
                Username=uname,
            )
        except Exception:
            pass


@pytest.fixture
def confirmed_user(admin_user_factory):
    """Creates a fresh confirmed user and returns the user credentials."""
    return admin_user_factory()


@pytest.fixture
def authenticated_user(api_url, confirmed_user):
    """
    Logs in the confirmed user via POST /auth/login and returns
    credentials, tokens (AccessToken, RefreshToken, IdToken), and auth headers.
    """
    response = requests.post(
        f"{api_url}/auth/login",
        json={
            "username": confirmed_user["username"],
            "password": confirmed_user["password"],
        },
        timeout=10,
    )
    assert response.status_code == 200, f"Failed to log in fixture user: {response.text}"
    auth_result = response.json()

    access_token = auth_result["AccessToken"]
    return {
        **confirmed_user,
        "access_token": access_token,
        "refresh_token": auth_result.get("RefreshToken"),
        "id_token": auth_result.get("IdToken"),
        "auth_headers": {"Authorization": f"Bearer {access_token}"},
    }

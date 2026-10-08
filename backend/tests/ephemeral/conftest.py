import os
import time
import uuid
import pytest
import requests


@pytest.fixture(scope="session")
def api_url():
    """Returns the base API URL and ensures the service is ready."""
    url = os.getenv("API_URL").rstrip("/")

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
        pytest.fail(f"API at {url} did not become ready within {
                    max_retries * delay} seconds.")

    return url


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
    assert response.status_code == 200, f"Failed to create fixture user: {
        response.text}"
    return user_data

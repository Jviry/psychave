import uuid
import requests


def test_create_user_success(api_url, generate_user_credentials):
    user_data = generate_user_credentials()
    response = requests.post(
        f"{api_url}/auth/create-user", json=user_data, timeout=10)

    assert response.status_code == 200
    data = response.json()
    assert data.get("message") == "register successful, check email for code"


def test_create_user_duplicate_username(api_url, registered_user, generate_user_credentials):
    duplicate_user = generate_user_credentials()
    duplicate_user["username"] = registered_user["username"]

    response = requests.post(
        f"{api_url}/auth/create-user", json=duplicate_user, timeout=10)
    assert response.status_code == 400


def test_create_user_duplicate_email(api_url, registered_user, generate_user_credentials):
    duplicate_user = generate_user_credentials()
    duplicate_user["email"] = registered_user["email"]

    response = requests.post(
        f"{api_url}/auth/create-user", json=duplicate_user, timeout=10)
    assert response.status_code == 400


def test_create_user_weak_password(api_url, generate_user_credentials):
    user_data = generate_user_credentials()
    user_data["password"] = "short"

    response = requests.post(
        f"{api_url}/auth/create-user", json=user_data, timeout=10)
    assert response.status_code == 400


def test_create_user_invalid_email(api_url, generate_user_credentials):
    user_data = generate_user_credentials()
    user_data["email"] = "not-a-valid-email"

    response = requests.post(
        f"{api_url}/auth/create-user", json=user_data, timeout=10)
    assert response.status_code == 422


def test_create_user_missing_required_fields(api_url):
    response = requests.post(
        f"{api_url}/auth/create-user", json={}, timeout=10)
    assert response.status_code == 422


def test_resend_code_success(api_url, registered_user):
    response = requests.post(
        f"{api_url}/auth/resend-code",
        params={"username": registered_user["username"]},
        timeout=10
    )

    assert response.status_code == 200
    data = response.json()
    assert data.get("message") == "confirmation code sent"


def test_resend_code_nonexistent_user(api_url):
    nonexistent_username = f"nonexistent_{uuid.uuid4().hex[:8]}"
    response = requests.post(
        f"{api_url}/auth/resend-code",
        params={"username": nonexistent_username},
        timeout=10
    )

    assert response.status_code == 400


def test_resend_code_missing_username(api_url):
    response = requests.post(f"{api_url}/auth/resend-code", timeout=10)
    assert response.status_code == 422


def test_request_forgot_password_unconfirmed_user(api_url, registered_user):
    # In Cognito, requesting forgot password for an unconfirmed user fails with 400
    response = requests.post(
        f"{api_url}/auth/request-forgot-password",
        params={"username": registered_user["username"]},
        timeout=10
    )

    assert response.status_code == 400


def test_request_forgot_password_nonexistent_user(api_url):
    nonexistent_username = f"nonexistent_{uuid.uuid4().hex[:8]}"
    response = requests.post(
        f"{api_url}/auth/request-forgot-password",
        params={"username": nonexistent_username},
        timeout=10
    )

    assert response.status_code == 400


def test_request_forgot_password_missing_username(api_url):
    response = requests.post(
        f"{api_url}/auth/request-forgot-password", timeout=10)
    assert response.status_code == 422

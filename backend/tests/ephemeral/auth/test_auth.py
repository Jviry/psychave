import uuid
import pytest
import requests


def test_create_user_success(api_url, generate_user_credentials):
    user_data = generate_user_credentials()
    response = requests.post(
        f"{api_url}/auth/create-user", json=user_data, timeout=10)

    assert response.status_code == 200
    data = response.json()
    print(f"Response: {response.text}")
    assert data.get("message") == "register successful, check email for code"


def test_create_user_duplicate_username(api_url, registered_user, generate_user_credentials):
    duplicate_user = generate_user_credentials()
    duplicate_user["username"] = registered_user["username"]

    response = requests.post(
        f"{api_url}/auth/create-user", json=duplicate_user, timeout=10)
    assert response.status_code == 400


def test_create_user_weak_password(api_url, generate_user_credentials):
    user_data = generate_user_credentials()
    user_data["password"] = "short"

    response = requests.post(
        f"{api_url}/auth/create-user", json=user_data, timeout=10)
    print(f"Response: {response.text}")
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


# --- Authenticated & Confirmed User Tests (Admin API Created) ---


def test_login_success(api_url, confirmed_user):
    response = requests.post(
        f"{api_url}/auth/login",
        json={
            "username": confirmed_user["username"],
            "password": confirmed_user["password"]
        },
        timeout=10
    )
    assert response.status_code == 200
    data = response.json()
    assert "AccessToken" in data
    assert "IdToken" in data


def test_login_invalid_password(api_url, confirmed_user):
    response = requests.post(
        f"{api_url}/auth/login",
        json={
            "username": confirmed_user["username"],
            "password": "WrongPassword123!"
        },
        timeout=10
    )
    assert response.status_code == 400


def test_login_nonexistent_user(api_url):
    response = requests.post(
        f"{api_url}/auth/login",
        json={
            "username": f"nonexistent_{uuid.uuid4().hex[:8]}",
            "password": "ValidPassword123!"
        },
        timeout=10
    )
    assert response.status_code == 400


def test_get_user_me_success(api_url, authenticated_user):
    response = requests.post(
        f"{api_url}/auth/me",
        headers={
            "Authorization": f"Bearer {authenticated_user['id_token']}"
        },
        params={"access_token": authenticated_user["access_token"]},
        timeout=10
    )

    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")

    assert response.status_code == 200

    data = response.json()
    assert data.get("Username") == authenticated_user["username"]


def test_get_user_me_invalid_token(api_url):
    response = requests.post(
        f"{api_url}/auth/me",
        params={"access_token": "invalid_access_token_123"},
        timeout=10
    )
    assert response.status_code == 401


def test_refresh_token_success(api_url, authenticated_user):
    refresh_token = authenticated_user.get("refresh_token")
    if not refresh_token:
        pytest.skip("No refresh token returned during login")

    response = requests.post(
        f"{api_url}/auth/refresh-token",
        params={"refresh_token": refresh_token},
        timeout=10
    )
    assert response.status_code == 200
    data = response.json()
    assert "AccessToken" in data


def test_refresh_token_invalid(api_url):
    response = requests.post(
        f"{api_url}/auth/refresh-token",
        params={"refresh_token": "invalid_refresh_token_123"},
        timeout=10
    )
    assert response.status_code == 400


def test_logout_success(api_url, admin_user_factory):
    user = admin_user_factory()
    login_res = requests.post(
        f"{api_url}/auth/login",
        json={"username": user["username"], "password": user["password"]},
        timeout=10
    )
    assert login_res.status_code == 200
    access_token = login_res.json()["AccessToken"]
    id_token = login_res.json()["IdToken"]

    headers = {"Authorization": f"Bearer {id_token}"}
    response = requests.post(
        f"{api_url}/auth/logout",
        headers=headers,
        params={"access_token": access_token},
        timeout=10
    )

    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")

    assert response.status_code == 200
    assert response.json().get("message") == "logout successful"


def test_logout_invalid_token(api_url):
    response = requests.post(
        f"{api_url}/auth/logout",
        params={"access_token": "invalid_access_token_123"},
        timeout=10
    )
    assert response.status_code == 401


def test_delete_user_self_success(api_url, admin_user_factory):
    user = admin_user_factory()
    login_res = requests.post(
        f"{api_url}/auth/login",
        json={"username": user["username"], "password": user["password"]},
        timeout=10
    )
    assert login_res.status_code == 200
    access_token = login_res.json()["AccessToken"]
    id_token = login_res.json()["IdToken"]

    headers = {"Authorization": f"Bearer {id_token}"}
    response = requests.delete(
        f"{api_url}/auth/delete",
        headers=headers,
        params={"access_token": access_token},
        timeout=10
    )

    print(f"Status: {response.status_code}")
    print(f"Response: {response.text}")

    assert response.status_code == 200
    assert response.json().get("message") == "delete user successful"

    # Verify user is deleted by trying to log in again
    retry_login = requests.post(
        f"{api_url}/auth/login",
        json={"username": user["username"], "password": user["password"]},
        timeout=10
    )
    assert retry_login.status_code == 400


def test_delete_user_invalid_token(api_url):
    response = requests.delete(
        f"{api_url}/auth/delete",
        params={"access_token": "invalid_access_token_123"},
        timeout=10
    )
    assert response.status_code == 401


def test_admin_user_factory_with_role(api_url, admin_user_factory):
    psychologist_user = admin_user_factory(role="psychologist")
    response = requests.post(
        f"{api_url}/auth/login",
        json={
            "username": psychologist_user["username"],
            "password": psychologist_user["password"]
        },
        timeout=10
    )
    assert response.status_code == 200
    data = response.json()
    assert "AccessToken" in data

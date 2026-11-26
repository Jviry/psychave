"""Seed a test client, psychologist, and admin in an ephemeral PR environment.

Usage (from repo root or backend/):
    API_URL=... COGNITO_USER_POOL_ID=... AWS_REGION=ap-southeast-1 python backend/src/seed_ephemeral_users.py

Idempotent: safe to re-run on PR synchronize. Never run against production.
"""

from __future__ import annotations

import os
import sys

import boto3
import httpx

DEFAULT_PASSWORD = os.getenv("EPHEMERAL_TEST_PASSWORD", "PsychAveTest123!")

SEED_USERS = (
    {
        "username": "test_client",
        "email": "ephemeral.client@psychave.test",
        "role": "client",
    },
    {
        "username": "test_psych",
        "email": "ephemeral.psych@psychave.test",
        "role": "psychologist",
    },
    {
        "username": "test_admin",
        "email": "ephemeral.admin@psychave.test",
        "role": "admin",
    },
)


def _ensure_cognito_user(
    cognito,
    user_pool_id: str,
    username: str,
    email: str,
    password: str,
    role: str,
) -> None:
    try:
        cognito.admin_get_user(UserPoolId=user_pool_id, Username=username)
    except cognito.exceptions.UserNotFoundException:
        cognito.admin_create_user(
            UserPoolId=user_pool_id,
            Username=username,
            UserAttributes=[
                {"Name": "email", "Value": email},
                {"Name": "email_verified", "Value": "true"},
                {"Name": "preferred_username", "Value": username},
            ],
            MessageAction="SUPPRESS",
        )

    cognito.admin_set_user_password(
        UserPoolId=user_pool_id,
        Username=username,
        Password=password,
        Permanent=True,
    )
    cognito.admin_add_user_to_group(
        UserPoolId=user_pool_id,
        Username=username,
        GroupName=role,
    )


def _login(api_url: str, username: str, password: str) -> dict[str, str]:
    res = httpx.post(
        f"{api_url}/auth/login",
        json={"username": username, "password": password},
        timeout=15,
    )
    res.raise_for_status()
    id_token = res.json()["IdToken"]
    return {"Authorization": f"Bearer {id_token}"}


def _seed_client_profile(api_url: str, headers: dict[str, str]) -> None:
    existing = httpx.get(f"{api_url}/profiles", headers=headers, timeout=15)
    if existing.status_code == 200 and existing.json():
        return

    res = httpx.post(
        f"{api_url}/profiles",
        headers=headers,
        json={
            "profile": {
                "relation_to_account_holder": "other",
                "profile_name": "Test Ephemeral Client",
                "date_of_birth": "1996-05-15",
                "occupation": "Tester",
                "nationality": "Filipino",
                "permanent_address": "Quezon City, Metro Manila",
                "present_address": "Quezon City, Metro Manila",
                "contact_number": "+639171234567",
                "socmed_platform": "messenger",
                "socmed_username": "test.ephemeral.client",
                "preferred_contact_mode": "messenger",
                "emergency_contact_name": "Emergency Contact",
                "emergency_contact_relation": "Sibling",
                "emergency_contact_number": "+639181234567",
            },
            "consent": {
                "consent_version": "v2",
                "terms_signer_name": "Test Ephemeral Client",
                "terms_signer_relation": "other",
                "scope_acknowledged": True,
                "is_overseas_or_foreign": False,
                "overseas_acknowledged": False,
                "information_confirmed": True,
                "consent_signer_name": "Test Ephemeral Client",
            },
        },
        timeout=15,
    )
    res.raise_for_status()


def _seed_psychologist_profile(api_url: str, headers: dict[str, str]) -> None:
    res = httpx.patch(
        f"{api_url}/psychologist-profile/me",
        headers=headers,
        json={
            "specialization": "Clinical Psychology",
            "license_number": "PRC-EPHEM-001",
            "bio": "Seeded ephemeral psychologist for QA testing.",
            "social_media_links": [
                {"platform": "Messenger", "url": "https://m.me/psychave.ephemeral.test"}
            ],
        },
        timeout=15,
    )
    res.raise_for_status()


def main() -> int:
    env_name = os.getenv("ENV", "").strip().lower()
    if env_name in ("prod", "production"):
        print("Refusing to seed ephemeral users in production.", file=sys.stderr)
        return 1

    api_url = os.environ["API_URL"].rstrip("/")
    pool_id = os.environ["COGNITO_USER_POOL_ID"]
    region = os.getenv("AWS_REGION", "ap-southeast-1")
    password = DEFAULT_PASSWORD

    cognito = boto3.client("cognito-idp", region_name=region)

    for spec in SEED_USERS:
        _ensure_cognito_user(
            cognito=cognito,
            user_pool_id=pool_id,
            username=spec["username"],
            email=spec["email"],
            password=password,
            role=spec["role"],
        )
        headers = _login(api_url, spec["username"], password)
        if spec["role"] == "client":
            _seed_client_profile(api_url, headers)
        elif spec["role"] == "psychologist":
            _seed_psychologist_profile(api_url, headers)
        print(f"Seeded {spec['role']}: {spec['username']}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

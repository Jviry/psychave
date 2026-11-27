"""Idempotent local dev seeder for Cognito + local Supabase Postgres.

Creates or updates 3 dev users (client, psychologist, admin) in the Cognito
User Pool configured in ``backend/.env``, assigns their Cognito groups, and
ensures matching rows exist in the local Postgres database.

Usage (from repo root):
    backend/.venv/bin/python backend/scripts/seed_local_users.py --password 'YourDevPassword123!'
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR / "src"))


def _load_env_file(env_path: Path) -> None:
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def _ensure_cognito_user(
    cognito,
    user_pool_id: str,
    username: str,
    email: str,
    password: str,
    role: str,
) -> str:
    try:
        resp = cognito.admin_create_user(
            UserPoolId=user_pool_id,
            Username=username,
            UserAttributes=[
                {"Name": "email", "Value": email},
                {"Name": "email_verified", "Value": "true"},
            ],
            MessageAction="SUPPRESS",
        )
        attrs = {a["Name"]: a["Value"] for a in resp["User"]["Attributes"]}
        sub = attrs["sub"]
        print(f"[cognito] created {username} ({role})")
    except ClientError as exc:
        if exc.response["Error"]["Code"] != "UsernameExistsException":
            raise
        resp = cognito.admin_get_user(UserPoolId=user_pool_id, Username=username)
        attrs = {a["Name"]: a["Value"] for a in resp["UserAttributes"]}
        sub = attrs["sub"]
        print(f"[cognito] exists  {username} ({role})")

    cognito.admin_set_user_password(
        UserPoolId=user_pool_id,
        Username=username,
        Password=password,
        Permanent=True,
    )

    existing_groups = {
        g["GroupName"]
        for g in cognito.admin_list_groups_for_user(
            UserPoolId=user_pool_id, Username=username
        ).get("Groups", [])
    }
    for group in ("client", "psychologist", "admin"):
        if group != role and group in existing_groups:
            cognito.admin_remove_user_from_group(
                UserPoolId=user_pool_id, Username=username, GroupName=group
            )
    if role not in existing_groups:
        cognito.admin_add_user_to_group(
            UserPoolId=user_pool_id, Username=username, GroupName=role
        )
    return sub


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed local client/psychologist/admin users.")
    parser.add_argument(
        "--password",
        default=os.environ.get("SEED_PASSWORD"),
        help="Password to set for all 3 seeded Cognito accounts (or set SEED_PASSWORD).",
    )
    parser.add_argument(
        "--db-url",
        default="postgresql://postgres:postgres@127.0.0.1:54322/postgres",
        help="Target local Postgres URL (defaults to local Supabase on 54322).",
    )
    args = parser.parse_args()

    password = args.password or getpass.getpass("Password for seeded dev accounts: ")
    if not password:
        raise SystemExit("A non-empty password is required.")

    _load_env_file(BACKEND_DIR / ".env")
    os.environ["DATABASE_URL"] = args.db_url

    user_pool_id = os.environ.get("COGNITO_USER_POOL_ID")
    if not user_pool_id:
        raise SystemExit("COGNITO_USER_POOL_ID is missing in backend/.env")

    region = os.environ.get("AWS_REGION") or user_pool_id.split("_", 1)[0]
    cognito = boto3.client("cognito-idp", region_name=region)

    seed_accounts = [
        ("dev_client", "dev.client@psychave.local", "client", "Dev Client"),
        ("dev_psych", "dev.psych@psychave.local", "psychologist", "Dr. Dev Psychologist"),
        ("dev_admin", "dev.admin@psychave.local", "admin", "Dev Admin"),
    ]

    subs: list[tuple[str, str, str, str]] = []
    for username, email, role, display_name in seed_accounts:
        sub = _ensure_cognito_user(
            cognito, user_pool_id, username, email, password, role
        )
        subs.append((sub, email, role, display_name))

    from datetime import date
    from sqlmodel import Session
    from common.database import engine
    from models.profile import ProfileRelation
    from models.psychologist_profile import PsychologistProfile
    from models.user import User
    from repo.consent_template_repo import ConsentTemplateRepo
    from repo.profile_repo import ProfileRepo
    from repo.user_repo import UserRepository
    from schemas.profile import ProfileCreate

    with Session(engine) as db:
        active_template = ConsentTemplateRepo(db).ensure_default_seeded()
        user_repo = UserRepository(db)
        profile_repo = ProfileRepo(db)
        for sub, email, role, display_name in subs:
            user = user_repo.get_by_sub(sub)
            if user is None:
                user = user_repo.create(User(cognito_sub=sub, email=email, role=role))
                print(f"[db]      created {email} ({role})")
            else:
                if user.role != role or user.email != email:
                    user.role = role
                    user.email = email
                    user_repo.update(user)
                print(f"[db]      exists  {email} ({role})")
            user_repo.ensure_role_profile(user, display_name=display_name)
            if role == "client" and profile_repo.get_self_profile(user.user_id) is None:
                profile_repo.create_with_consent(
                    client_id=user.user_id,
                    profile_data=ProfileCreate(
                        relation_to_account_holder=ProfileRelation.self_,
                        profile_name=display_name,
                        date_of_birth=date(1998, 5, 15),
                        socmed_platform="Messenger",
                        socmed_username="dev.client",
                    ),
                    consent_version=active_template.consent_version,
                    details={
                        "preferred_contact_mode": "email",
                        "contact_number": "09171234567",
                    },
                    responses={
                        "agreed": True,
                        "consent_version": active_template.consent_version,
                    },
                )
                print(f"[db]      created 'self' profile + consent for {email}")
            if role == "psychologist":
                psych = db.get(PsychologistProfile, user.user_id)
                if psych and not psych.social_media_links:
                    psych.social_media_links = [
                        {"platform": "Facebook", "url": "https://facebook.com/psychave.dev"}
                    ]
                    db.add(psych)
                    db.commit()

    print("\nDone! You can log in at http://localhost:3000/login with:")
    for username, email, role, _ in seed_accounts:
        print(f"  - {role:12s}: username={username} (or {email})")


if __name__ == "__main__":
    main()

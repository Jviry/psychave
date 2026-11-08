from functools import lru_cache
from typing import Any
from fastapi import Depends, Header
from sqlmodel import Session

from common.database import get_db
from common.exceptions import (
    ForbiddenError,
    UnauthenticatedError,
    UserNotFoundError,
)
from interfaces.auth import AuthService
from models.psychologist_profile import PsychologistProfile
from models.user import User, UserRole
from repo.user_repo import UserRepository
from services.auth.cognito_service import CognitoService


def get_claims(authorization: str | None = Header(default=None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthenticatedError("Invalid authorization header")

    token = authorization.removeprefix("Bearer ").strip()

    try:
        return auth_service.verify_token(token)
    except UnauthenticatedError:
        raise
    except Exception as exc:
        raise UnauthenticatedError("Invalid or expired token") from exc


def get_current_user(
    claims: dict[str, Any] = Depends(get_claims),
    db: Session = Depends(get_db),
) -> User:
    sub = claims.get("sub")

    if not sub:
        raise UnauthenticatedError("Invalid or expired token")

    user = UserRepository(db).get_by_sub(sub)

    if user is None:
        raise UserNotFoundError()

    return user


def require_role(*allowed_roles: UserRole):
    allowed = {role.value for role in allowed_roles}

    def role_checker(
        claims: dict[str, Any] = Depends(get_claims),
        user: User = Depends(get_current_user),
    ) -> User:
        groups = set(claims.get("cognito:groups", [])
                     or claims.get("groups", []))

        if not allowed & groups:
            raise ForbiddenError()

        return user

    return role_checker


def get_current_psychologist(
    user: User = Depends(require_role(UserRole.PSYCHOLOGIST)),
    db: Session = Depends(get_db),
) -> PsychologistProfile:
    profile = db.get(PsychologistProfile, user.user_id)

    if profile is None:
        raise ForbiddenError("Psychologist profile not found")

    return profile

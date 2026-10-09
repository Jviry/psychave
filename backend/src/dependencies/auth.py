from fastapi import Depends, Header
from sqlmodel import Session

from common.database import get_db
from common.exceptions import (
    ForbiddenError,
    UnauthenticatedError,
    UserNotFoundError,
)
from common.security.cognito import verify_token
from models.user import User, UserRole
from repo.user_repo import UserRepository


def get_claims(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise UnauthenticatedError("Invalid authorization header")

    token = authorization.removeprefix("Bearer ").strip()

    try:
        return verify_token(token)
    except Exception as exc:
        raise UnauthenticatedError("Invalid or expired token") from exc


def get_current_user(
    claims: dict = Depends(get_claims),
    db: Session = Depends(get_db),
) -> User:
    cognito_sub = claims.get("sub")

    if not cognito_sub:
        raise UnauthenticatedError("Invalid or expired token")

    user = UserRepository(db).get_by_cognito_sub(cognito_sub)

    if user is None:
        raise UserNotFoundError()

    return user


def require_role(*allowed_roles: UserRole):
    allowed = {role.value for role in allowed_roles}

    def role_checker(claims: dict = Depends(get_claims)) -> dict:
        groups = set(claims.get("cognito:groups", []))

        if not allowed & groups:
            raise ForbiddenError()

        return claims

    return role_checker

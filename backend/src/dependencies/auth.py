from fastapi import Depends, HTTPException, Header
from sqlmodel import Session, select

from common.security.cognito import verify_token
from common.database import get_db
from models.user import User, UserRole


def get_current_user(
    authorization: str = Header(...),
    db: Session = Depends(get_db),
) -> User:

    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header"
        )

    token = authorization.removeprefix("Bearer ").strip()

    try:
        claims = verify_token(token)
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    cognito_sub = claims["sub"]

    user = db.exec(
        select(User).where(User.cognito_sub == cognito_sub)
    ).first()

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    return user


def require_role(*allowed_roles: UserRole):

    def role_checker(
        current_user: User = Depends(get_current_user)
    ):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail="Insufficient permissions"
            )

        return current_user

    return role_checker

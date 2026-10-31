import uuid

from fastapi import APIRouter, Depends, Query
from sqlmodel import Session

from common.database import get_db
from dependencies.auth import require_role
from models.user import User, UserRole
from schemas.admin import (
    AdminUserPage,
    AdminUserRead,
    PromotePsychologistRequest,
    UpdateUserRoleRequest,
)
from services.aws.cognito_service import CognitoService
from usecase.admin_usecase import AdminUsecase

router = APIRouter()


@router.get("/users", response_model=AdminUserPage)
def list_users(
    role: UserRole | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    auth_service: CognitoService = Depends(CognitoService),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """List user accounts with search, role filtering, and pagination."""
    return AdminUsecase(auth_service, db).list_users(
        role, search, page, page_size
    )


@router.patch("/users/{user_id}/role", response_model=AdminUserRead)
def update_user_role(
    user_id: uuid.UUID,
    payload: UpdateUserRoleRequest,
    auth_service: CognitoService = Depends(CognitoService),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Change a user's role and swap their Cognito access group."""
    return AdminUsecase(auth_service, db).change_role(
        user_id,
        payload.role,
        payload.full_name,
        current_user.user_id,
    )


@router.post("/users/{user_id}/promote", response_model=AdminUserRead)
def promote_psychologist(
    user_id: uuid.UUID,
    payload: PromotePsychologistRequest,
    auth_service: CognitoService = Depends(CognitoService),
    current_user: User = Depends(require_role(UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Promote an existing client to psychologist and create their profile."""
    return AdminUsecase(auth_service, db).promote_to_psychologist(user_id, payload)

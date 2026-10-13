from fastapi import APIRouter, Depends
from sqlmodel import Session

from common.database import get_db
from dependencies.auth import require_role
from models.user import User, UserRole
from usecase.service_usecase import ServiceUsecase
from schemas.service import ServiceRead

router = APIRouter()


@router.get("", response_model=list[ServiceRead])
def list_services(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.CLIENT, UserRole.ADMIN, UserRole.PSYCHOLOGIST))
):
    uc = ServiceUsecase(db)
    return uc.get_all()


@router.get("/active", response_model=list[ServiceRead])
def list_services_active(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(
        UserRole.ADMIN, UserRole.CLIENT, UserRole.PSYCHOLOGIST))
):
    uc = ServiceUsecase(db)
    return uc.get_all_active()

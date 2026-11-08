from fastapi import APIRouter

from dependencies.auth import DbDep
from schemas.service import ServiceRead
from usecase.service_usecase import ServiceUsecase

router = APIRouter()


@router.get("", response_model=list[ServiceRead])
def list_services(db: DbDep):
    """Public catalog of active services."""
    uc = ServiceUsecase(db)
    return uc.get_all_active()


@router.get("/active", response_model=list[ServiceRead])
def list_services_active(db: DbDep):
    """Public catalog: used by the marketing home page before login."""
    uc = ServiceUsecase(db)
    return uc.get_all_active()

import uuid
from fastapi import APIRouter

from dependencies.auth import AdminUserDep, DbDep
from schemas.service import ServiceCreate, ServiceRead, ServiceUpdate
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


@router.get("/all", response_model=list[ServiceRead])
def list_all_services_admin(
    db: DbDep,
    current_user: AdminUserDep,
):
    """Admin CMS catalog of all services (including inactive ones)."""
    uc = ServiceUsecase(db)
    return uc.get_all()


@router.post("", response_model=ServiceRead)
def create_service(
    payload: ServiceCreate,
    db: DbDep,
    current_user: AdminUserDep,
):
    """Admin CMS endpoint to create a new service."""
    uc = ServiceUsecase(db)
    return uc.create_service(payload)


@router.patch("/{service_id}", response_model=ServiceRead)
def update_service(
    service_id: uuid.UUID,
    payload: ServiceUpdate,
    db: DbDep,
    current_user: AdminUserDep,
):
    """Admin CMS endpoint to edit service copy, duration, notice, or active status."""
    uc = ServiceUsecase(db)
    return uc.update_service(service_id, payload)

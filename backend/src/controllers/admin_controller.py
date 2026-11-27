import uuid

from fastapi import APIRouter, Query

from dependencies.auth import AdminUserDep, AuthServiceDep, DbDep
from dependencies.payments import PaymentProviderDep
from models.appointment import AppointmentStatus
from models.user import UserRole
from schemas.admin import (
    AdminRefundRequest,
    AdminUserDetailRead,
    AdminUserPage,
    ManualPaymentConfirmRequest,
    PsychologistInvitationCreate,
    PsychologistInvitationRead,
)
from schemas.appointment import AppointmentRead
from usecase.admin_usecase import AdminUsecase

router = APIRouter()


@router.get("/users", response_model=AdminUserPage)
def list_users(
    auth_service: AuthServiceDep,
    current_user: AdminUserDep,
    db: DbDep,
    role: UserRole | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
):
    """List user accounts with search, role filtering, and pagination."""
    return AdminUsecase(auth_service, db).list_users(
        role, search, page, page_size
    )


@router.get("/users/{user_id}", response_model=AdminUserDetailRead)
def get_user_detail(
    user_id: uuid.UUID,
    auth_service: AuthServiceDep,
    current_user: AdminUserDep,
    db: DbDep,
):
    """Retrieve account and profile details for a single user."""
    return AdminUsecase(auth_service, db).get_user_detail(user_id)


@router.post(
    "/psychologist-invitations",
    response_model=PsychologistInvitationRead,
    status_code=201,
)
def invite_psychologist(
    payload: PsychologistInvitationCreate,
    auth_service: AuthServiceDep,
    current_user: AdminUserDep,
    db: DbDep,
):
    """Generate a single-use expiring psychologist invitation and email the link."""
    return AdminUsecase(auth_service, db).invite_psychologist(
        payload, current_user.user_id
    )


@router.get("/appointments", response_model=list[AppointmentRead])
def list_admin_appointments(
    auth_service: AuthServiceDep,
    current_user: AdminUserDep,
    db: DbDep,
    status: AppointmentStatus | None = Query(default=AppointmentStatus.AWAITING_PAYMENT),
):
    """List appointments (defaults to awaiting_payment) for admin verification."""
    return AdminUsecase(auth_service, db).list_appointments(status=status)


@router.post(
    "/appointments/{appointment_id}/confirm-payment",
    response_model=AppointmentRead,
)
def confirm_manual_payment(
    appointment_id: uuid.UUID,
    auth_service: AuthServiceDep,
    current_user: AdminUserDep,
    db: DbDep,
    payload: ManualPaymentConfirmRequest | None = None,
):
    """Mark an awaiting-payment appointment as manually paid and confirmed."""
    note = payload.note if payload is not None else None
    return AdminUsecase(auth_service, db).confirm_manual_payment(
        appointment_id, note=note
    )


@router.post(
    "/appointments/{appointment_id}/refund",
    response_model=AppointmentRead,
)
def refund_appointment(
    appointment_id: uuid.UUID,
    payload: AdminRefundRequest,
    auth_service: AuthServiceDep,
    current_user: AdminUserDep,
    db: DbDep,
    provider: PaymentProviderDep,
):
    """Issue a partial refund for a paid appointment and record an audit trail."""
    return AdminUsecase(auth_service, db).refund_appointment(
        appointment_id,
        payload,
        acting_admin_id=current_user.user_id,
        provider=provider,
    )

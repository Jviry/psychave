import uuid
from fastapi import APIRouter, Depends
from sqlmodel import Session

from common.database import get_db
from dependencies.auth import require_role
from models.user import User, UserRole
from models.appointment import AppointmentStatus
from usecase.appointment_usecase import AppointmentUsecase
from schemas.appointment import (
    AppointmentCreate,
    AppointmentRead,
    SlotSelect,
    ProposedSlotRead
)

router = APIRouter()


@router.post("", response_model=AppointmentRead)
def create_appointment(
    payload: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CLIENT))
):
    uc = AppointmentUsecase(db)
    return uc.create_appointment(payload, current_user.user_id)


@router.get("", response_model=list[AppointmentRead])
def list_appointments(
    status: AppointmentStatus | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CLIENT))
):
    uc = AppointmentUsecase(db)
    return uc.list_appointments(current_user.user_id, status)


@router.get("/{appointment_id}", response_model=AppointmentRead)
def get_appointment(
    appointment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CLIENT))
):
    uc = AppointmentUsecase(db)
    return uc.get_appointment(appointment_id, current_user.user_id)


@router.get("/{appointment_id}/slots", response_model=list[ProposedSlotRead])
def get_slots(
    appointment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CLIENT))
):
    uc = AppointmentUsecase(db)
    return uc.get_slots(appointment_id, current_user.user_id)


@router.post("/{appointment_id}/select-slot", response_model=AppointmentRead)
def select_slot(
    appointment_id: uuid.UUID,
    payload: SlotSelect,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CLIENT))
):
    uc = AppointmentUsecase(db)
    return uc.select_slot(appointment_id, payload.slot_id, current_user.user_id)


@router.delete("/{appointment_id}", response_model=AppointmentRead)
def cancel_appointment(
    appointment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CLIENT))
):
    uc = AppointmentUsecase(db)
    return uc.cancel_appointment(appointment_id, current_user.user_id)

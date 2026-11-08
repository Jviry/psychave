from typing import Annotated
import uuid

from fastapi import APIRouter, Depends

from dependencies.auth import ClientUserDep, DbDep, require_role
from dependencies.payments import PaymentProviderDep
from models.appointment import AppointmentStatus
from models.user import User, UserRole
from schemas.appointment import (
    AppointmentCreate,
    AppointmentRead,
    PreferredSlotsUpdate,
    ProposedSlotRead,
    SlotSelect,
)
from schemas.payment import PaymentInitiateRequest, PaymentRead
from usecase.appointment_usecase import AppointmentUsecase
from usecase.payment_usecase import PaymentUsecase
from usecase.psychologist_usecase import PsychologistUsecase

router = APIRouter()

ClientOrPsychUserDep = Annotated[
    User, Depends(require_role(UserRole.CLIENT, UserRole.PSYCHOLOGIST))
]


# ----- booking -----
@router.post("", response_model=AppointmentRead)
def create_appointment(
    payload: AppointmentCreate,
    db: DbDep,
    current_user: ClientUserDep,
):
    uc = AppointmentUsecase(db)
    return uc.create_appointment(payload, current_user.user_id)


@router.get("", response_model=list[AppointmentRead])
def list_appointments(
    db: DbDep,
    current_user: ClientUserDep,
    status: AppointmentStatus | None = None,
):
    uc = AppointmentUsecase(db)
    return uc.list_appointments(current_user.user_id, status)


@router.get("/{appointment_id}", response_model=AppointmentRead)
def get_appointment(
    appointment_id: uuid.UUID,
    db: DbDep,
    current_user: ClientOrPsychUserDep,
):
    if current_user.role == UserRole.PSYCHOLOGIST.value:
        return PsychologistUsecase(db).get_detail(appointment_id, current_user.user_id)
    uc = AppointmentUsecase(db)
    return uc.get_appointment(appointment_id, current_user.user_id)


@router.delete("/{appointment_id}", response_model=AppointmentRead)
def cancel_appointment(
    appointment_id: uuid.UUID,
    db: DbDep,
    current_user: ClientUserDep,
):
    uc = AppointmentUsecase(db)
    return uc.cancel_appointment(appointment_id, current_user.user_id)


# ----- schedule negotiation -----
@router.get("/{appointment_id}/slots", response_model=list[ProposedSlotRead])
def get_slots(
    appointment_id: uuid.UUID,
    db: DbDep,
    current_user: ClientUserDep,
):
    uc = AppointmentUsecase(db)
    return uc.get_slots(appointment_id, current_user.user_id)


@router.post("/{appointment_id}/accept-slot", response_model=AppointmentRead)
def accept_counter_slot(
    appointment_id: uuid.UUID,
    payload: SlotSelect,
    db: DbDep,
    current_user: ClientUserDep,
):
    uc = AppointmentUsecase(db)
    return uc.accept_counter_slot(appointment_id, payload.slot_id, current_user.user_id)


@router.post("/{appointment_id}/preferred-slots", response_model=AppointmentRead)
def replace_preferred_slots(
    appointment_id: uuid.UUID,
    payload: PreferredSlotsUpdate,
    db: DbDep,
    current_user: ClientUserDep,
):
    uc = AppointmentUsecase(db)
    return uc.replace_preferences(appointment_id, payload, current_user.user_id)


# ----- payment -----
@router.post("/{appointment_id}/payment", response_model=PaymentRead)
def initiate_payment(
    appointment_id: uuid.UUID,
    db: DbDep,
    current_user: ClientUserDep,
    provider: PaymentProviderDep,
    payload: PaymentInitiateRequest | None = None,
):
    uc = PaymentUsecase(db, provider)
    return uc.initiate_payment(
        appointment_id,
        current_user.user_id,
        payment_method=payload.payment_method if payload else None,
        success_url=payload.success_url if payload else None,
        cancel_url=payload.cancel_url if payload else None,
    )


@router.get("/{appointment_id}/payment", response_model=list[PaymentRead])
def get_payments(
    appointment_id: uuid.UUID,
    db: DbDep,
    current_user: ClientUserDep,
    provider: PaymentProviderDep,
):
    uc = PaymentUsecase(db, provider)
    return uc.get_history(appointment_id, current_user.user_id)

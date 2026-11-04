import uuid

from fastapi import APIRouter, Depends
from sqlmodel import Session

from common.database import get_db
from dependencies.auth import get_current_psychologist
from models.appointment import AppointmentStatus
from models.psychologist_profile import PsychologistProfile
from schemas.appointment import (
    AppointmentRead,
    PendingAppointmentRead,
    SlotInput,
    SlotSelect,
)
from schemas.psychologist import (
    PickupRequest,
    PsychologistProfileRead,
    PsychologistProfileUpdate,
)
from usecase.psychologist_usecase import PsychologistUsecase

router = APIRouter()


# ----- pending requests / pickup -----
@router.get("/appointments/pending", response_model=list[PendingAppointmentRead])
def list_pending_appointments(
    db: Session = Depends(get_db),
    current_psychologist: PsychologistProfile = Depends(get_current_psychologist),
):
    return PsychologistUsecase(db).list_pending(
        current_psychologist.psychologist_id
    )


@router.post("/appointments/{appointment_id}/pickup", response_model=AppointmentRead)
def pickup_appointment(
    appointment_id: uuid.UUID,
    payload: PickupRequest,
    db: Session = Depends(get_db),
    current_psychologist: PsychologistProfile = Depends(get_current_psychologist),
):
    return PsychologistUsecase(db).pickup(
        appointment_id,
        current_psychologist.psychologist_id,
        payload,
    )


# ----- schedule negotiation -----
@router.post("/appointments/{appointment_id}/accept-preferred-slot", response_model=AppointmentRead)
def accept_preferred_slot(
    appointment_id: uuid.UUID,
    payload: SlotSelect,
    db: Session = Depends(get_db),
    current_psychologist: PsychologistProfile = Depends(get_current_psychologist),
):
    return PsychologistUsecase(db).accept_preferred_slot(
        appointment_id,
        payload.slot_id,
        current_psychologist.psychologist_id,
    )


@router.post("/appointments/{appointment_id}/counter-offer", response_model=AppointmentRead)
def counter_offer(
    appointment_id: uuid.UUID,
    payload: SlotInput,
    db: Session = Depends(get_db),
    current_psychologist: PsychologistProfile = Depends(get_current_psychologist),
):
    return PsychologistUsecase(db).counter_offer(
        appointment_id,
        payload,
        current_psychologist.psychologist_id,
    )


# ----- own schedule -----
@router.get("/appointments/mine", response_model=list[AppointmentRead])
def list_my_appointments(
    status: AppointmentStatus | None = None,
    db: Session = Depends(get_db),
    current_psychologist: PsychologistProfile = Depends(get_current_psychologist),
):
    return PsychologistUsecase(db).list_mine(
        current_psychologist.psychologist_id, status
    )


@router.post("/appointments/{appointment_id}/complete", response_model=AppointmentRead)
def complete_appointment(
    appointment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_psychologist: PsychologistProfile = Depends(get_current_psychologist),
):
    return PsychologistUsecase(db).complete_appointment(
        appointment_id, current_psychologist.psychologist_id
    )


# ----- profile -----
@router.get("/psychologist-profile/me", response_model=PsychologistProfileRead)
def get_my_profile(
    db: Session = Depends(get_db),
    current_psychologist: PsychologistProfile = Depends(get_current_psychologist),
):
    return current_psychologist


@router.patch("/psychologist-profile/me", response_model=PsychologistProfileRead)
def update_my_profile(
    payload: PsychologistProfileUpdate,
    db: Session = Depends(get_db),
    current_psychologist: PsychologistProfile = Depends(get_current_psychologist),
):
    updated = PsychologistUsecase(db).update_profile(current_psychologist, payload)
    return updated

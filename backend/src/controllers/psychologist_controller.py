import uuid
from fastapi import APIRouter, Depends
from sqlmodel import Session

from common.database import get_db
from dependencies.auth import (
    get_current_psychologist,
    require_approved_psychologist,
)
from models.appointment import AppointmentStatus
from models.psychologist_profile import PsychologistProfile
from schemas.appointment import AppointmentRead, ProposedSlotRead
from schemas.psychologist import (
    PickupRequest,
    PsychologistProfileRead,
    PsychologistProfileUpdate,
    SlotProposal,
)
from usecase.psychologist_usecase import PsychologistUsecase

router = APIRouter()


# ----- pending requests / pickup -----
@router.get("/appointments/pending", response_model=list[AppointmentRead])
def list_pending_appointments(
    db: Session = Depends(get_db),
    current_psychologist: PsychologistProfile = Depends(get_current_psychologist),
):
    return PsychologistUsecase(db).list_pending()


@router.post("/appointments/{appointment_id}/pickup", response_model=AppointmentRead)
def pickup_appointment(
    appointment_id: uuid.UUID,
    payload: PickupRequest,
    db: Session = Depends(get_db),
    current_psychologist: PsychologistProfile = Depends(require_approved_psychologist),
):
    return PsychologistUsecase(db).pickup(appointment_id, current_psychologist.psychologist_id, payload.price)


# ----- slot proposal -----
@router.post("/appointments/{appointment_id}/slots", response_model=list[ProposedSlotRead])
def propose_slots(
    appointment_id: uuid.UUID,
    payload: list[SlotProposal],
    db: Session = Depends(get_db),
    current_psychologist: PsychologistProfile = Depends(require_approved_psychologist),
):
    return PsychologistUsecase(db).propose_slots(appointment_id, current_psychologist.psychologist_id, payload)


# ----- own schedule -----
@router.get("/appointments/mine", response_model=list[AppointmentRead])
def list_my_appointments(
    status: AppointmentStatus | None = None,
    db: Session = Depends(get_db),
    current_psychologist: PsychologistProfile = Depends(get_current_psychologist),
):
    return PsychologistUsecase(db).list_mine(current_psychologist.psychologist_id, status)


@router.post("/appointments/{appointment_id}/complete", response_model=AppointmentRead)
def complete_appointment(
    appointment_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_psychologist: PsychologistProfile = Depends(require_approved_psychologist),
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

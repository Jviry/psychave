from typing import Annotated
import uuid

from fastapi import APIRouter, Depends

from dependencies.auth import ClientUserDep, DbDep, require_role
from models.user import User, UserRole
from schemas.persona import (
    PersonaCreate,
    PersonaRead,
    PersonaReviewResponse,
    PersonaWithConsentCreate,
)
from usecase.persona_usecase import PersonaUsecase

router = APIRouter()

PsychologistUserDep = Annotated[User, Depends(require_role(UserRole.PSYCHOLOGIST))]


# client api
@router.post("", response_model=PersonaRead)
def create_persona(
    payload: PersonaWithConsentCreate,
    db: DbDep,
    current_user: ClientUserDep,
):
    usecase = PersonaUsecase(db)
    return usecase.create_persona(payload, current_user.user_id)


@router.get("", response_model=list[PersonaRead])
def list_personas(
    db: DbDep,
    current_user: ClientUserDep,
):
    usecase = PersonaUsecase(db)
    return usecase.list_personas(current_user.user_id)


@router.get("/{persona_id}", response_model=PersonaRead)
def get_persona(
    persona_id: uuid.UUID,
    db: DbDep,
    current_user: ClientUserDep,
):
    usecase = PersonaUsecase(db)
    return usecase.get_persona(persona_id, current_user.user_id)


@router.delete("/{persona_id}", response_model=PersonaRead)
def delete_persona(
    persona_id: uuid.UUID,
    db: DbDep,
    current_user: ClientUserDep,
):
    usecase = PersonaUsecase(db)
    return usecase.delete_persona(persona_id, current_user.user_id)


@router.put("/{persona_id}", response_model=PersonaRead)
def update_persona(
    persona_id: uuid.UUID,
    payload: PersonaCreate,
    db: DbDep,
    current_user: ClientUserDep,
):
    usecase = PersonaUsecase(db)
    return usecase.update_persona(persona_id, payload, current_user.user_id)


# psychologist api
@router.get("/{persona_id}/review", response_model=PersonaReviewResponse)
def get_persona_for_review(
    persona_id: uuid.UUID,
    db: DbDep,
    current_user: PsychologistUserDep,
):
    usecase = PersonaUsecase(db)
    return usecase.get_persona_for_psychologist(persona_id)

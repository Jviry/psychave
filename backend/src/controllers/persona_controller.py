import uuid
from fastapi import APIRouter, Depends
from sqlmodel import Session

from common.database import get_db
from dependencies.auth import require_role
from models.user import User, UserRole
from usecase.persona_usecase import PersonaUsecase
from schemas.persona import PersonaWithConsentCreate, PersonaRead

router = APIRouter(prefix="/personas")


@router.post("", response_model=PersonaRead)
def create_persona(
    payload: PersonaWithConsentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CLIENT)),
):
    usecase = PersonaUsecase(db)
    return usecase.create_persona(payload, current_user.user_id)


@router.get("", response_model=list[PersonaRead])
def list_personas(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CLIENT)),
):
    usecase = PersonaUsecase(db)
    return usecase.list_personas(current_user.user_id)


@router.get("/{persona_id}", response_model=PersonaRead)
def get_persona(
    persona_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.CLIENT)),
):
    usecase = PersonaUsecase(db)
    return usecase.get_persona(persona_id, current_user.user_id)


@router.get("{persona_id}/review", response_model=PersonaWithConsentCreate)
def get_persona_for_review(
    persona_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.PSYCHOLOGIST))
):
    usecase = PersonaUsecase(db)
    return usecase.get_persona_for_psychologist(persona_id)

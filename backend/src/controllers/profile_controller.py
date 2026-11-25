from typing import Annotated
import uuid

from fastapi import APIRouter, Depends

from dependencies.auth import ClientUserDep, DbDep, require_role
from models.user import User, UserRole
from schemas.profile import (
    ConsentCreate,
    ProfileCreate,
    ProfileRead,
    ProfileReviewResponse,
    ProfileWithConsentCreate,
)
from usecase.profile_usecase import ProfileUsecase

router = APIRouter()

PsychologistUserDep = Annotated[User, Depends(require_role(UserRole.PSYCHOLOGIST))]


# client api
@router.post("", response_model=ProfileRead)
def create_profile(
    payload: ProfileWithConsentCreate,
    db: DbDep,
    current_user: ClientUserDep,
):
    usecase = ProfileUsecase(db)
    return usecase.create_profile(payload, current_user.user_id)


@router.post("/{profile_id}/consent", response_model=ProfileRead)
def resign_profile_consent(
    profile_id: uuid.UUID,
    payload: ConsentCreate,
    db: DbDep,
    current_user: ClientUserDep,
):
    """Re-sign the active major consent form for an existing profile."""
    usecase = ProfileUsecase(db)
    return usecase.resign_consent(profile_id, payload, current_user.user_id)


@router.get("", response_model=list[ProfileRead])
def list_profiles(
    db: DbDep,
    current_user: ClientUserDep,
):
    usecase = ProfileUsecase(db)
    return usecase.list_profiles(current_user.user_id)


@router.get("/{profile_id}", response_model=ProfileRead)
def get_profile(
    profile_id: uuid.UUID,
    db: DbDep,
    current_user: ClientUserDep,
):
    usecase = ProfileUsecase(db)
    return usecase.get_profile(profile_id, current_user.user_id)


@router.delete("/{profile_id}", response_model=ProfileRead)
def delete_profile(
    profile_id: uuid.UUID,
    db: DbDep,
    current_user: ClientUserDep,
):
    usecase = ProfileUsecase(db)
    return usecase.delete_profile(profile_id, current_user.user_id)


@router.put("/{profile_id}", response_model=ProfileRead)
def update_profile(
    profile_id: uuid.UUID,
    payload: ProfileCreate,
    db: DbDep,
    current_user: ClientUserDep,
):
    usecase = ProfileUsecase(db)
    return usecase.update_profile(profile_id, payload, current_user.user_id)


# psychologist api
@router.get("/{profile_id}/review", response_model=ProfileReviewResponse)
def get_profile_for_review(
    profile_id: uuid.UUID,
    db: DbDep,
    current_user: PsychologistUserDep,
):
    usecase = ProfileUsecase(db)
    return usecase.get_profile_for_psychologist(profile_id, current_user.user_id)

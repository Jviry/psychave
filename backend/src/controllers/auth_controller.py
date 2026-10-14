from fastapi import APIRouter, Depends
from sqlmodel import Session
from common.database import get_db
from dependencies.auth import get_current_user
from services.aws.cognito_service import CognitoService
from usecase.auth_usecase import AuthUsecase
from models.user import User
from schemas.auth_model import (
    UserLogin,
    UserCreate,
    ConfirmUserRequest,
    ForgotPasswordConfirm
)

router = APIRouter()


@router.post("/me")
def get_user(
    access_token: str,
    auth_service: CognitoService = Depends(CognitoService),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uc = AuthUsecase(auth_service, db)
    return uc.get_user(access_token)


@router.post("/login")
def login_user(
    credentials: UserLogin,
    auth_service: CognitoService = Depends(CognitoService),
    db: Session = Depends(get_db),
):
    uc = AuthUsecase(auth_service, db)
    return uc.login_user(credentials)


@router.post("/refresh-token")
def refresh_access_token(
    refresh_token: str,
    auth_service: CognitoService = Depends(CognitoService),
    db: Session = Depends(get_db),
):
    uc = AuthUsecase(auth_service, db)
    return uc.refresh_access_token(refresh_token)


@router.post("/create-user")
def create_user(
    credentials: UserCreate,
    auth_service: CognitoService = Depends(CognitoService),
    db: Session = Depends(get_db),
):
    uc = AuthUsecase(auth_service, db)
    return uc.create_user(credentials)


@router.post("/confirm")
def confirm_user(
    request: ConfirmUserRequest,
    auth_service: CognitoService = Depends(CognitoService),
    db: Session = Depends(get_db),
):
    uc = AuthUsecase(auth_service, db)
    return uc.confirm_user(request)


@router.post("/resend-code")
def resend_confirmation_code(
    username: str,
    auth_service: CognitoService = Depends(CognitoService),
    db: Session = Depends(get_db),
):
    uc = AuthUsecase(auth_service, db)
    return uc.resend_confirmation_code(username)


@router.post("/logout")
def logout_user(
    access_token: str,
    auth_service: CognitoService = Depends(CognitoService),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uc = AuthUsecase(auth_service, db)
    return uc.logout_user(access_token)


@router.post("/request-forgot-password")
def request_forgot_password(
    username: str,
    auth_service: CognitoService = Depends(CognitoService),
    db: Session = Depends(get_db),
):
    uc = AuthUsecase(auth_service, db)
    return uc.request_forgot_password(username)


@router.post("/confirm-forgot-password")
def confirm_forgot_password(
    request: ForgotPasswordConfirm,
    auth_service: CognitoService = Depends(CognitoService),
    db: Session = Depends(get_db),
):
    uc = AuthUsecase(auth_service, db)
    return uc.confirm_forgot_password(request)


@router.delete("/delete")
def delete_user(
    access_token: str,
    auth_service: CognitoService = Depends(CognitoService),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    uc = AuthUsecase(auth_service, db)
    return uc.delete_user(access_token)

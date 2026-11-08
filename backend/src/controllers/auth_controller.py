from fastapi import APIRouter

from dependencies.auth import AuthServiceDep, CurrentUserDep, DbDep
from schemas.auth_model import (
    ConfirmUserRequest,
    ForgotPasswordConfirm,
    UserCreate,
    UserLogin,
)
from usecase.auth_usecase import AuthUsecase

router = APIRouter()


@router.post("/me")
def get_user(
    access_token: str,
    auth_service: AuthServiceDep,
    current_user: CurrentUserDep,
    db: DbDep,
):
    uc = AuthUsecase(auth_service, db)
    user = uc.get_user(access_token)
    return user.to_dict()


@router.post("/login")
def login_user(
    credentials: UserLogin,
    auth_service: AuthServiceDep,
    db: DbDep,
):
    uc = AuthUsecase(auth_service, db)
    tokens = uc.login_user(credentials)
    return tokens.to_dict()


@router.post("/refresh-token")
def refresh_access_token(
    refresh_token: str,
    auth_service: AuthServiceDep,
    db: DbDep,
):
    uc = AuthUsecase(auth_service, db)
    tokens = uc.refresh_access_token(refresh_token)
    return tokens.to_dict()


@router.post("/create-user")
def create_user(
    credentials: UserCreate,
    auth_service: AuthServiceDep,
    db: DbDep,
):
    uc = AuthUsecase(auth_service, db)
    return uc.create_user(credentials)


@router.post("/confirm")
def confirm_user(
    request: ConfirmUserRequest,
    auth_service: AuthServiceDep,
    db: DbDep,
):
    uc = AuthUsecase(auth_service, db)
    return uc.confirm_user(request)


@router.post("/resend-code")
def resend_confirmation_code(
    username: str,
    auth_service: AuthServiceDep,
    db: DbDep,
):
    uc = AuthUsecase(auth_service, db)
    return uc.resend_confirmation_code(username)


@router.post("/logout")
def logout_user(
    access_token: str,
    auth_service: AuthServiceDep,
    current_user: CurrentUserDep,
    db: DbDep,
):
    uc = AuthUsecase(auth_service, db)
    return uc.logout_user(access_token)


@router.post("/request-forgot-password")
def request_forgot_password(
    username: str,
    auth_service: AuthServiceDep,
    db: DbDep,
):
    uc = AuthUsecase(auth_service, db)
    return uc.request_forgot_password(username)


@router.post("/confirm-forgot-password")
def confirm_forgot_password(
    request: ForgotPasswordConfirm,
    auth_service: AuthServiceDep,
    db: DbDep,
):
    uc = AuthUsecase(auth_service, db)
    return uc.confirm_forgot_password(request)


@router.delete("/delete")
def delete_user(
    access_token: str,
    auth_service: AuthServiceDep,
    current_user: CurrentUserDep,
    db: DbDep,
):
    uc = AuthUsecase(auth_service, db)
    return uc.delete_user(access_token)

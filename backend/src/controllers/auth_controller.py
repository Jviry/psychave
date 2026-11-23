from fastapi import APIRouter, Request

from dependencies.auth import AuthServiceDep, CurrentUserDep, DbDep
from schemas.auth_model import (
    ConfirmUserRequest,
    ForgotPasswordConfirm,
    PsychologistInvitationVerifyRead,
    PsychologistInviteRegisterRequest,
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


@router.get(
    "/psychologist-invitations/{token}",
    response_model=PsychologistInvitationVerifyRead,
)
def verify_psychologist_invitation(
    token: str,
    auth_service: AuthServiceDep,
    db: DbDep,
):
    uc = AuthUsecase(auth_service, db)
    return uc.verify_psychologist_invitation(token)


@router.post("/register-psychologist")
def register_invited_psychologist(
    payload: PsychologistInviteRegisterRequest,
    auth_service: AuthServiceDep,
    db: DbDep,
):
    uc = AuthUsecase(auth_service, db)
    return uc.register_invited_psychologist(payload)


def _client_ip(http_request: Request) -> str:
    forwarded_for = http_request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return http_request.client.host if http_request.client else "unknown"


@router.post("/confirm")
def confirm_user(
    request: ConfirmUserRequest,
    http_request: Request,
    auth_service: AuthServiceDep,
    db: DbDep,
):
    uc = AuthUsecase(auth_service, db)
    return uc.confirm_user(request, client_ip=_client_ip(http_request))


@router.post("/resend-code")
def resend_confirmation_code(
    username: str,
    http_request: Request,
    auth_service: AuthServiceDep,
    db: DbDep,
):
    uc = AuthUsecase(auth_service, db)
    return uc.resend_confirmation_code(username, client_ip=_client_ip(http_request))


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
    http_request: Request,
    auth_service: AuthServiceDep,
    db: DbDep,
):
    uc = AuthUsecase(auth_service, db)
    return uc.request_forgot_password(username, client_ip=_client_ip(http_request))


@router.post("/confirm-forgot-password")
def confirm_forgot_password(
    request: ForgotPasswordConfirm,
    http_request: Request,
    auth_service: AuthServiceDep,
    db: DbDep,
):
    uc = AuthUsecase(auth_service, db)
    return uc.confirm_forgot_password(request, client_ip=_client_ip(http_request))


@router.delete("/delete")
def delete_user(
    access_token: str,
    auth_service: AuthServiceDep,
    current_user: CurrentUserDep,
    db: DbDep,
):
    uc = AuthUsecase(auth_service, db)
    return uc.delete_user(access_token)

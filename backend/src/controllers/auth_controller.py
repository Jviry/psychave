from fastapi import APIRouter, Depends, HTTPException
from usecases.auth_usecase import AuthUsecase
from services.aws.cognito_service import CognitoService
from botocore.exceptions import ClientError
from models.auth_model import (
    UserLogin,
    UserCreate,
    ConfirmUserRequest,
    ForgotPasswordConfirm
)

router = APIRouter()


@router.post("/me")
async def get_user(
    access_token: str,
    auth_service: CognitoService = Depends(CognitoService)

):
    try:
        uc = AuthUsecase(auth_service)
        return uc.get_user(access_token)

    except ClientError as e:
        error_message = e.response["Error"]["Message"]
        raise HTTPException(status_code=400, detail=error_message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/login")
async def login_user(
    credentials: UserLogin,
    auth_service: CognitoService = Depends(CognitoService)
):
    try:
        uc = AuthUsecase(auth_service)
        return uc.login_user(credentials)

    except ClientError as e:
        error_message = e.response["Error"]["Message"]
        raise HTTPException(status_code=400, detail=error_message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/refresh-token")
async def refresh_access_token(
    refresh_token: str,
    auth_service: CognitoService = Depends(CognitoService)
):
    try:
        uc = AuthUsecase(auth_service)
        return uc.refresh_access_token(refresh_token)

    except ClientError as e:
        error_message = e.response["Error"]["Message"]
        raise HTTPException(status_code=400, detail=error_message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create-user")
async def create_user(
    credentials: UserCreate,
    auth_service: CognitoService = Depends(CognitoService),
):
    try:
        uc = AuthUsecase(auth_service)
        return uc.create_user(credentials)

    except ClientError as e:
        error_message = e.response["Error"]["Message"]
        raise HTTPException(status_code=400, detail=error_message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/confirm")
async def confirm_user(
    request: ConfirmUserRequest,
    auth_service: CognitoService = Depends(CognitoService)
):
    try:
        uc = AuthUsecase(auth_service)
        return uc.confirm_user(request)

    except ClientError as e:
        error_message = e.response["Error"]["Message"]
        raise HTTPException(status_code=400, detail=error_message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/resend-code")
async def resend_confirmation_code(
    username: str,
    auth_service: CognitoService = Depends(CognitoService)
):
    try:
        uc = AuthUsecase(auth_service)
        return uc.resend_confirmation_code(username)

    except ClientError as e:
        error_message = e.response["Error"]["Message"]
        raise HTTPException(status_code=400, detail=error_message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/logout")
async def logout_user(
    access_tokens: str,
    auth_service: CognitoService = Depends(CognitoService)
):
    try:
        uc = AuthUsecase(auth_service)
        return uc.logout_user(access_tokens)

    except ClientError as e:
        error_message = e.response["Error"]["Message"]
        raise HTTPException(status_code=400, detail=error_message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/request-forgot-password")
async def request_forgot_password(
    username: str,
    auth_service: CognitoService = Depends(CognitoService)
):
    try:
        uc = AuthUsecase(auth_service)
        return uc.request_forgot_password(username)

    except ClientError as e:
        error_message = e.response["Error"]["Message"]
        raise HTTPException(status_code=400, detail=error_message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/confirm-forgot-password")
async def confirm_forgot_password(
    request: ForgotPasswordConfirm,
    auth_service: CognitoService = Depends(CognitoService)
):
    try:
        uc = AuthUsecase(auth_service)
        return uc.confirm_forgot_password(request)

    except ClientError as e:
        error_message = e.response["Error"]["Message"]
        raise HTTPException(status_code=400, detail=error_message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/delete")
async def delete_user(
    access_tokens: str,
    auth_service: CognitoService = Depends(CognitoService)
):
    try:
        uc = AuthUsecase(auth_service)
        return uc.delete_user(access_tokens)

    except ClientError as e:
        error_message = e.response["Error"]["Message"]
        raise HTTPException(status_code=400, detail=error_message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

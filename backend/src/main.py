from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
import logging

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from mangum import Mangum

from common.database import engine
from common.exceptions import (
    DomainError,
    ForbiddenError,
    UnauthenticatedError,
    UserNotFoundError,
)
from common.settings import settings
from controllers.app_router import app_router

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncGenerator[None, None]:
    yield
    engine.dispose()


def create_app() -> FastAPI:
    application = FastAPI(
        title=settings.APP_NAME,
        debug=settings.DEBUG,
        lifespan=lifespan,
    )

    # boto3 CLIENT-side failures (NoCredentialsError, EndpointConnectionError,
    # PartialCredentialsError, ...) are NOT ClientError subclasses — without this
    # handler they escape every exception handler and reach ServerErrorMiddleware,
    # whose 500 responses bypass the CORS middleware (the browser then reports a
    # phantom "blocked by CORS policy" instead of the real provider error).
    @application.exception_handler(BotoCoreError)
    async def botocore_error_handler(_: Request, exc: BotoCoreError):
        logger.exception("AWS client-side failure: %s", exc)
        return JSONResponse(
            status_code=503,
            content={"detail": "Service temporarily unavailable"},
        )

    # Last-resort net: an unhandled 500 from ServerErrorMiddleware also loses CORS
    # headers. Always answer JSON (with CORS, since this middleware sits inside
    # CORSMiddleware) and still log the full traceback for the server console.
    @application.exception_handler(Exception)
    async def unhandled_exception_handler(_: Request, exc: Exception):
        logger.exception("Unhandled exception: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"},
        )

    @application.exception_handler(DomainError)
    async def domain_error_handler(_: Request, exc: DomainError):
        return JSONResponse(
            status_code=exc.status_code, content={"detail": exc.detail}
        )

    @application.exception_handler(ClientError)
    async def cognito_error_handler(_: Request, exc: ClientError):
        error = exc.response.get("Error", {})
        code = error.get("Code", "")
        status_code = {
            "NotAuthorizedException": 401,
            "UserNotFoundException": 404,
            "UsernameExistsException": 409,
        }.get(code, 400)
        return JSONResponse(
            status_code=status_code,
            content={"detail": error.get("Message", "Authentication error")},
        )

    @application.exception_handler(UnauthenticatedError)
    async def unauthenticated_handler(_: Request, exc: UnauthenticatedError):
        return JSONResponse(status_code=401, content={"detail": exc.message})

    @application.exception_handler(UserNotFoundError)
    async def user_not_found_handler(_: Request, exc: UserNotFoundError):
        return JSONResponse(status_code=401, content={"detail": exc.message})

    @application.exception_handler(ForbiddenError)
    async def forbidden_handler(_: Request, exc: ForbiddenError):
        return JSONResponse(status_code=403, content={"detail": exc.message})

    application.include_router(app_router)

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @application.get("/health", tags=["Health"])
    async def health_check():
        return {"status": "ok", "env": settings.ENV}

    return application


app = create_app()
handler = Mangum(app)

__all__ = ["app", "create_app", "handler", "lifespan"]



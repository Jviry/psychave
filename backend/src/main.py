from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from mangum import Mangum
from fastapi.middleware.cors import CORSMiddleware
import logging

from common.exceptions import (
    ForbiddenError,
    UnauthenticatedError,
    UserNotFoundError,
)
from botocore.exceptions import BotoCoreError, ClientError
from common.settings import settings
from common.exceptions import DomainError
from controllers.app_router import app_router

app = FastAPI(title=settings.APP_NAME, debug=settings.DEBUG)

handler = Mangum(app)

logger = logging.getLogger("uvicorn.error")

# boto3 CLIENT-side failures (NoCredentialsError, EndpointConnectionError,
# PartialCredentialsError, ...) are NOT ClientError subclasses — without this
# handler they escape every exception handler and reach ServerErrorMiddleware,
# whose 500 responses bypass the CORS middleware (the browser then reports a
# phantom "blocked by CORS policy" instead of the real provider error).
@app.exception_handler(BotoCoreError)
async def botocore_error_handler(_: Request, exc: BotoCoreError):
    logger.exception("AWS client-side failure: %s", exc)
    return JSONResponse(
        status_code=503,
        content={"detail": f"AWS provider error: {exc}"},
    )


# Last-resort net: an unhandled 500 from ServerErrorMiddleware also loses CORS
# headers. Always answer JSON (with CORS, since this middleware sits inside
# CORSMiddleware) and still log the full traceback for the server console.
@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, exc: Exception):
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


@app.exception_handler(DomainError)
async def domain_error_handler(_: Request, exc: DomainError):
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(ClientError)
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


@app.exception_handler(UnauthenticatedError)
async def unauthenticated_handler(request, exc: UnauthenticatedError):
    return JSONResponse(status_code=401, content={"detail": exc.message})


@app.exception_handler(UserNotFoundError)
async def user_not_found_handler(request, exc: UserNotFoundError):
    return JSONResponse(status_code=401, content={"detail": exc.message})


@app.exception_handler(ForbiddenError)
async def forbidden_handler(request, exc: ForbiddenError):
    return JSONResponse(status_code=403, content={"detail": exc.message})


app.include_router(app_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "env": settings.ENV}


@app.get("/hello")
async def hello_world():
    return {"hello": "world"}

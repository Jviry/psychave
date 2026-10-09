from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from mangum import Mangum
from fastapi.middleware.cors import CORSMiddleware
from botocore.exceptions import ClientError
from common.settings import settings
from common.exceptions import DomainError
from controllers.app_router import app_router

app = FastAPI(title=settings.APP_NAME, debug=settings.DEBUG)

handler = Mangum(app)


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

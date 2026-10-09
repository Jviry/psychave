from fastapi import FastAPI
from mangum import Mangum
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from common.exceptions import (
    ForbiddenError,
    UnauthenticatedError,
    UserNotFoundError,
)
from common.settings import settings
from controllers.app_router import app_router

app = FastAPI(title=settings.APP_NAME, debug=settings.DEBUG)

handler = Mangum(app)

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


@app.exception_handler(UnauthenticatedError)
async def unauthenticated_handler(request, exc: UnauthenticatedError):
    return JSONResponse(status_code=401, content={"detail": exc.message})


@app.exception_handler(UserNotFoundError)
async def user_not_found_handler(request, exc: UserNotFoundError):
    return JSONResponse(status_code=401, content={"detail": exc.message})


@app.exception_handler(ForbiddenError)
async def forbidden_handler(request, exc: ForbiddenError):
    return JSONResponse(status_code=403, content={"detail": exc.message})


@app.get("/hello")
async def hello_world():
    return {"hello": "world"}

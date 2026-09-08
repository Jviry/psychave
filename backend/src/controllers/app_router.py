from fastapi import APIRouter
from controllers.auth_controller import router as auth_router

app_router = APIRouter()

app_router.include_router(auth_router, tags=["Auth"])

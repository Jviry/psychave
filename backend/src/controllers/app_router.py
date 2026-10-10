from fastapi import APIRouter
from controllers.auth_controller import router as auth_router
from controllers.persona_controller import router as persona_router
from controllers.appointment_controller import router as appointment_router

app_router = APIRouter()

app_router.include_router(auth_router, prefix="/auth", tags=["auth"])
app_router.include_router(
    persona_router, prefix="/personas", tags=["personas"])
app_router.include_router(
    appointment_router, prefix="/appointment", tags=["appointments"])

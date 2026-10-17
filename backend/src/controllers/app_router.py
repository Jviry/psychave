from fastapi import APIRouter
from controllers.auth_controller import router as auth_router
from controllers.persona_controller import router as persona_router
from controllers.appointment_controller import router as appointment_router
from controllers.payment_controller import router as payment_router
from controllers.psychologist_controller import router as psychologist_router
from controllers.service_controller import router as service_router

app_router = APIRouter()

app_router.include_router(auth_router, prefix="/auth", tags=["auth"])
app_router.include_router(
    persona_router, prefix="/personas", tags=["personas"])
app_router.include_router(
    psychologist_router, tags=["psychologist"])
app_router.include_router(
    appointment_router, prefix="/appointments", tags=["appointments"])
app_router.include_router(
    payment_router, prefix="/payments", tags=["payments"])
app_router.include_router(
    service_router, prefix="/services", tags=["services"])

"""FastAPI dependency providers and typed Annotated aliases."""
from dependencies.auth import (
    AdminUserDep,
    AuthServiceDep,
    ClientUserDep,
    CurrentPsychologistDep,
    CurrentUserDep,
    DbDep,
    get_auth_service,
    get_claims,
    get_current_psychologist,
    get_current_user,
    require_role,
)
from dependencies.payments import PaymentProviderDep, get_payment_provider

__all__ = [
    "get_auth_service",
    "get_claims",
    "get_current_user",
    "require_role",
    "get_current_psychologist",
    "get_payment_provider",
    "DbDep",
    "AuthServiceDep",
    "CurrentUserDep",
    "CurrentPsychologistDep",
    "ClientUserDep",
    "AdminUserDep",
    "PaymentProviderDep",
]

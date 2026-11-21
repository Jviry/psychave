"""Email provider wiring. Swap to SesService when a custom domain is ready."""

from services.brevo.brevo_service import BrevoService
from services.email.base import BaseEmailService


def get_email_service() -> BaseEmailService:
    return BrevoService()

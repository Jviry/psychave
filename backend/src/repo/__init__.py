"""Data access repositories."""
from repo.appointment_repo import AppointmentRepo
from repo.cms_repo import CmsRepo
from repo.consent_template_repo import ConsentTemplateRepo
from repo.payment_repo import PaymentRepo
from repo.profile_repo import ProfileRepo
from repo.psychologist_repo import PsychologistRepo
from repo.service_repo import ServiceRepo
from repo.user_repo import UserRepository

__all__ = [
    "AppointmentRepo",
    "PaymentRepo",
    "ProfileRepo",
    "PsychologistRepo",
    "ServiceRepo",
    "UserRepository",
]

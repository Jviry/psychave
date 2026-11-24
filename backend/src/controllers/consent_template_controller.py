from fastapi import APIRouter

from dependencies.auth import AdminUserDep, DbDep
from schemas.consent_template import (
    ConsentFormTemplateRead,
    ConsentFormTemplateUpsert,
)
from usecase.consent_template_usecase import ConsentTemplateUsecase

router = APIRouter()


@router.get("/active", response_model=ConsentFormTemplateRead)
def get_active_consent_form(db: DbDep):
    """Public/Client endpoint returning the currently active multi-page wizard schema and version."""
    uc = ConsentTemplateUsecase(db)
    return uc.get_active_template()


@router.get("/templates", response_model=list[ConsentFormTemplateRead])
def list_consent_form_templates(
    db: DbDep,
    current_user: AdminUserDep,
):
    """Admin CMS endpoint listing all versioned consent/wizard templates."""
    uc = ConsentTemplateUsecase(db)
    return uc.list_templates()


@router.put("/active", response_model=ConsentFormTemplateRead)
def update_active_consent_form(
    payload: ConsentFormTemplateUpsert,
    db: DbDep,
    current_user: AdminUserDep,
):
    """Admin CMS endpoint to update active wizard pages/fields or publish a new version."""
    uc = ConsentTemplateUsecase(db)
    return uc.update_active_template(payload)

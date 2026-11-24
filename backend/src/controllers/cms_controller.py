import uuid
from fastapi import APIRouter, Response, status

from dependencies.auth import AdminUserDep, DbDep
from schemas.cms import (
    CmsContentRead,
    CmsContentUpdate,
    TestimonialCreate,
    TestimonialRead,
    TestimonialUpdate,
)
from usecase.cms_usecase import CmsUsecase

router = APIRouter()


@router.get("", response_model=CmsContentRead)
def get_public_cms(db: DbDep):
    """Public CMS copy (Vision, Mission, Clinic Overview, Impact) and active testimonials."""
    uc = CmsUsecase(db)
    return uc.get_cms(active_only=True)


@router.get("/admin", response_model=CmsContentRead)
def get_admin_cms(db: DbDep, current_user: AdminUserDep):
    """Admin CMS copy and all testimonials (including hidden/inactive)."""
    uc = CmsUsecase(db)
    return uc.get_cms(active_only=False)


@router.put("", response_model=CmsContentRead)
def update_cms_content(
    payload: CmsContentUpdate,
    db: DbDep,
    current_user: AdminUserDep,
):
    """Admin CMS endpoint to update Vision, Mission, Clinic Overview, and Impact Narrative."""
    uc = CmsUsecase(db)
    return uc.update_cms(payload)


@router.post("/testimonials", response_model=TestimonialRead)
def create_testimonial(
    payload: TestimonialCreate,
    db: DbDep,
    current_user: AdminUserDep,
):
    """Admin CMS endpoint to create a testimonial."""
    uc = CmsUsecase(db)
    return uc.create_testimonial(payload)


@router.patch("/testimonials/{testimonial_id}", response_model=TestimonialRead)
def update_testimonial(
    testimonial_id: uuid.UUID,
    payload: TestimonialUpdate,
    db: DbDep,
    current_user: AdminUserDep,
):
    """Admin CMS endpoint to edit or toggle visibility of a testimonial."""
    uc = CmsUsecase(db)
    return uc.update_testimonial(testimonial_id, payload)


@router.delete("/testimonials/{testimonial_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_testimonial(
    testimonial_id: uuid.UUID,
    db: DbDep,
    current_user: AdminUserDep,
):
    """Admin CMS endpoint to remove a testimonial."""
    uc = CmsUsecase(db)
    uc.delete_testimonial(testimonial_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

import uuid
from sqlmodel import Session

from common.exceptions import NotFoundError
from models.cms import Testimonial
from repo.cms_repo import CmsRepo
from schemas.cms import (
    CmsContentRead,
    CmsContentUpdate,
    TestimonialCreate,
    TestimonialRead,
    TestimonialUpdate,
)


class CmsUsecase:
    def __init__(self, db: Session):
        self.db = db
        self.repo = CmsRepo(db)

    def get_cms(self, *, active_only: bool) -> CmsContentRead:
        content = self.repo.get_or_seed_content()
        testimonials = self.repo.list_testimonials(active_only=active_only)
        return CmsContentRead(
            vision=content.vision,
            mission=content.mission,
            clinic_overview=content.clinic_overview,
            impact_narrative=content.impact_narrative,
            evaluation_form_url=content.evaluation_form_url,
            updated_at=content.updated_at,
            testimonials=[
                TestimonialRead.model_validate(t, from_attributes=True)
                for t in testimonials
            ],
        )

    def update_cms(self, payload: CmsContentUpdate) -> CmsContentRead:
        content = self.repo.update_content(payload)
        testimonials = self.repo.list_testimonials(active_only=False)
        return CmsContentRead(
            vision=content.vision,
            mission=content.mission,
            clinic_overview=content.clinic_overview,
            impact_narrative=content.impact_narrative,
            evaluation_form_url=content.evaluation_form_url,
            updated_at=content.updated_at,
            testimonials=[
                TestimonialRead.model_validate(t, from_attributes=True)
                for t in testimonials
            ],
        )

    def create_testimonial(self, payload: TestimonialCreate) -> Testimonial:
        return self.repo.create_testimonial(payload)

    def update_testimonial(
        self, testimonial_id: uuid.UUID, payload: TestimonialUpdate
    ) -> Testimonial:
        row = self.repo.get_testimonial(testimonial_id)
        if row is None:
            raise NotFoundError("Testimonial not found")
        return self.repo.update_testimonial(row, payload)

    def delete_testimonial(self, testimonial_id: uuid.UUID) -> None:
        row = self.repo.get_testimonial(testimonial_id)
        if row is None:
            raise NotFoundError("Testimonial not found")
        self.repo.delete_testimonial(row)

from datetime import datetime, timezone
import uuid
from sqlmodel import Session, select

from models.cms import (
    CmsContent,
    DEFAULT_TESTIMONIALS,
    Testimonial,
)
from schemas.cms import CmsContentUpdate, TestimonialCreate, TestimonialUpdate


class CmsRepo:
    def __init__(self, db: Session):
        self.db = db

    def get_or_seed_content(self) -> CmsContent:
        content = self.db.exec(select(CmsContent)).first()
        if content is not None:
            return content
        content = CmsContent()
        self.db.add(content)
        self.db.commit()
        self.db.refresh(content)
        return content

    def update_content(self, payload: CmsContentUpdate) -> CmsContent:
        content = self.get_or_seed_content()
        content.vision = payload.vision
        content.mission = payload.mission
        content.clinic_overview = payload.clinic_overview
        content.impact_narrative = payload.impact_narrative
        content.evaluation_form_url = payload.evaluation_form_url
        content.updated_at = datetime.now(timezone.utc)
        self.db.add(content)
        self.db.commit()
        self.db.refresh(content)
        return content

    def list_testimonials(self, *, active_only: bool) -> list[Testimonial]:
        stmt = select(Testimonial)
        if active_only:
            stmt = stmt.where(Testimonial.is_active == True)  # noqa: E712
        stmt = stmt.order_by(Testimonial.display_order, Testimonial.created_at)
        rows = list(self.db.exec(stmt).all())
        if not rows and not self.db.exec(select(Testimonial)).first():
            # Lazy-seed default testimonials for fresh in-memory/SQLite test DBs
            now = datetime.now(timezone.utc)
            for item in DEFAULT_TESTIMONIALS:
                t = Testimonial(
                    testimonial_id=item["testimonial_id"],  # type: ignore[arg-type]
                    quote=str(item["quote"]),
                    author_label=str(item["author_label"]),
                    service_category=str(item["service_category"]),
                    is_active=bool(item["is_active"]),
                    display_order=int(item["display_order"]),  # type: ignore[arg-type]
                    created_at=now,
                )
                self.db.add(t)
            self.db.commit()
            rows = list(self.db.exec(stmt).all())
        return rows

    def get_testimonial(self, testimonial_id: uuid.UUID) -> Testimonial | None:
        return self.db.get(Testimonial, testimonial_id)

    def create_testimonial(self, payload: TestimonialCreate) -> Testimonial:
        row = Testimonial(**payload.model_dump())
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def update_testimonial(
        self, row: Testimonial, payload: TestimonialUpdate
    ) -> Testimonial:
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(row, field, value)
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def delete_testimonial(self, row: Testimonial) -> None:
        self.db.delete(row)
        self.db.commit()

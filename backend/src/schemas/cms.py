from datetime import datetime
from urllib.parse import urlparse
import uuid
from pydantic import field_validator
from sqlmodel import SQLModel


class TestimonialRead(SQLModel):
    testimonial_id: uuid.UUID
    quote: str
    author_label: str
    service_category: str
    is_active: bool
    display_order: int
    created_at: datetime


class TestimonialCreate(SQLModel):
    quote: str
    author_label: str
    service_category: str
    is_active: bool = True
    display_order: int = 0

    @field_validator("quote", "author_label", "service_category")
    @classmethod
    def not_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field cannot be blank")
        return cleaned


class TestimonialUpdate(SQLModel):
    quote: str | None = None
    author_label: str | None = None
    service_category: str | None = None
    is_active: bool | None = None
    display_order: int | None = None

    @field_validator("quote", "author_label", "service_category")
    @classmethod
    def optional_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field cannot be blank")
        return cleaned


class CmsContentRead(SQLModel):
    vision: str
    mission: str
    clinic_overview: str
    impact_narrative: str
    evaluation_form_url: str | None = None
    updated_at: datetime
    testimonials: list[TestimonialRead] = []


class CmsContentUpdate(SQLModel):
    vision: str
    mission: str
    clinic_overview: str
    impact_narrative: str
    evaluation_form_url: str | None = None

    @field_validator("vision", "mission", "clinic_overview", "impact_narrative")
    @classmethod
    def not_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field cannot be blank")
        return cleaned

    @field_validator("evaluation_form_url")
    @classmethod
    def validate_evaluation_form_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            return None
        parsed = urlparse(cleaned)
        if parsed.scheme != "https" or not parsed.netloc:
            raise ValueError("Evaluation form URL must be a valid https:// URL")
        return cleaned

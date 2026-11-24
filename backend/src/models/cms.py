from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, DateTime
from sqlmodel import Field, SQLModel

DEFAULT_VISION = (
    "Accessible, ethically grounded psychological care across the Philippines where every "
    "session begins with clarity, verified credentials, and respect for client privacy."
)

DEFAULT_MISSION = (
    "Deliver structured, compassionate mental health and advisory services through "
    "PRC-verified practitioners, clear booking guardrails, and strict RA 10173 confidentiality."
)

DEFAULT_CLINIC_OVERVIEW = (
    "PsychAvenuePH (PSYCHAVE PH) connects clients across the Philippines with PRC-registered "
    "resident psychologists through structured scheduling, transparent clinical fees, and "
    "consent-first data governance."
)

DEFAULT_IMPACT_NARRATIVE = (
    "Our client-first scheduling architecture eliminates double-booking conflicts and "
    "protects clinical boundaries before, during, and after every session."
)

DEFAULT_TESTIMONIALS: list[dict[str, object]] = [
    {
        "testimonial_id": uuid.UUID("a1111111-1111-4111-8111-111111111101"),
        "quote": (
            "The structured intake and clear session expectations helped me feel grounded "
            "even before my first consultation. Everything felt respectful and unhurried."
        ),
        "author_label": "Client · Individual Counseling",
        "service_category": "Individual Counseling & Psychotherapy",
        "is_active": True,
        "display_order": 1,
    },
    {
        "testimonial_id": uuid.UUID("a1111111-1111-4111-8111-111111111102"),
        "quote": (
            "Having dedicated 15-minute individual check-ins before our joint couples "
            "conversation gave both of us room to be heard without talking over each other."
        ),
        "author_label": "Couple · Quezon City",
        "service_category": "Couples Counseling",
        "is_active": True,
        "display_order": 2,
    },
    {
        "testimonial_id": uuid.UUID("a1111111-1111-4111-8111-111111111103"),
        "quote": (
            "Starting with a 45-minute standalone consultation took away the pressure of "
            "committing immediately and helped me understand what kind of support fit best."
        ),
        "author_label": "Client · Overseas Filipino",
        "service_category": "Standalone Clinical Consultation",
        "is_active": True,
        "display_order": 3,
    },
    {
        "testimonial_id": uuid.UUID("a1111111-1111-4111-8111-111111111104"),
        "quote": (
            "The research supervision sessions clarified our statistical methodology in a "
            "single afternoon while keeping academic ownership squarely with our team."
        ),
        "author_label": "Graduate Researcher · Metro Manila",
        "service_category": "Academic & Research Services",
        "is_active": True,
        "display_order": 4,
    },
]


class CmsContent(SQLModel, table=True):
    __tablename__: str = "cms_content"

    cms_id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    vision: str = Field(default=DEFAULT_VISION)
    mission: str = Field(default=DEFAULT_MISSION)
    clinic_overview: str = Field(default=DEFAULT_CLINIC_OVERVIEW)
    impact_narrative: str = Field(default=DEFAULT_IMPACT_NARRATIVE)
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class Testimonial(SQLModel, table=True):
    __tablename__: str = "testimonials"

    testimonial_id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    quote: str
    author_label: str
    service_category: str
    is_active: bool = True
    display_order: int = 0
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )

"""Seed the ``services`` table from docs/services-catalog.md.

Usage (from the ``backend/`` directory):

    python src/seed_services.py

Idempotent: rows are matched by a stable UUID derived from the service slug,
so re-running updates name/description/is_active instead of duplicating rows.
Existing appointments that reference a seeded service keep working.
"""

import uuid

from sqlmodel import Session

from common.database import engine
from models.service import Service

# Deterministic ids — never reorder or rename a slug once it ships, or a new
# row will be created for the same catalog entry.
_NAMESPACE = uuid.UUID("8f3c1d2a-5b6e-4f70-9a81-2c3d4e5f6071")


def _service_id(slug: str) -> uuid.UUID:
    return uuid.uuid5(_NAMESPACE, slug)


# Source: docs/services-catalog.md (deck slides, Images 5-6). The backend model
# only carries name + description, so duration and guardrail rules are folded
# into the description where the catalog states them.
SERVICES: list[dict[str, object]] = [
    {
        "slug": "standalone-clinical-consultation",
        "name": "Standalone Clinical Consultation",
        "description": (
            "45-minute initial support session for clients. Before meeting with "
            "their psychologist, clients may be asked to complete a brief set of "
            "screening tools, if necessary or upon request. Includes discussion of "
            "screening results, addressing client inquiries, and providing brief "
            "supplementary activities as appropriate. Guardrail: this is not a full "
            "therapy session but an initial step toward further psychological support."
        ),
    },
    {
        "slug": "individual-counseling-psychotherapy",
        "name": "Individual Counseling & Psychotherapy",
        "description": (
            "1-hour supportive space for clients to explore personal experiences and "
            "concerns. The psychologist collaborates with the client to identify "
            "therapeutic goals and develop a tailored treatment plan. Brief "
            "assessments or relevant psychotherapy worksheets and activities may be "
            "provided to enhance insight and facilitate progress."
        ),
    },
    {
        "slug": "couples-counseling",
        "name": "Couples Counseling",
        "description": (
            "1.5-hour structured session supporting partners in exploring "
            "relationship concerns, communication patterns, goals, conflict "
            "resolution strategies, and other relevant issues. Advisable to allocate "
            "15-minute individual breakout sessions with each partner, followed by a "
            "joint session for the remainder of the time. Therapeutic worksheets, "
            "activities, and treatment planning may be incorporated as needed; all "
            "interventions are tailored to the couple's unique dynamics and goals."
        ),
    },
    {
        "slug": "family-group-counseling",
        "name": "Family & Group Counseling",
        "description": (
            "2-hour session available based on the arrangements and clinical "
            "judgment of the assigned psychologist. Psychologists with training "
            "and/or specialization in family counseling have full autonomy to "
            "determine the most appropriate therapeutic approach and techniques "
            "suited to the needs of the group or family system."
        ),
    },
    {
        "slug": "life-coaching",
        "name": "Life Coaching",
        "description": (
            "Designed to guide and support clients in completing therapy-related "
            "activities and assignments provided by their respective psychologists. "
            "Structured, brief, and solution-focused, including goal setting and "
            "regular check-ins to promote accountability and progress. Guardrail: "
            "life coaching is not a substitute for therapy."
        ),
    },
    {
        "slug": "clinical-supervision-early-career-psychologists",
        "name": "Clinical Supervision for Early Career Psychologists",
        "description": (
            "Supervision for newly registered psychologists as they navigate early "
            "clinical practice. Available to both practitioners affiliated with the "
            "clinic and those practicing externally."
        ),
    },
    {
        "slug": "academic-research-services",
        "name": "Academic & Research Services",
        "description": (
            "Expert support in thesis supervision and data analysis to guide "
            "students through their research journey. Guardrail: does not include "
            "taking full responsibility for writing an entire thesis report. The "
            "psychologist supports, mentors, and assists the student in "
            "understanding and completing their own work."
        ),
    },
]


def seed_services() -> tuple[int, int]:
    """Upsert the catalog rows. Returns (created, updated) counts."""
    created = 0
    updated = 0

    # The app engine echoes every statement when DEBUG=true. A seed run only
    # needs the final summary, so keep SQLAlchemy quiet for this process.
    engine.echo = False

    with Session(engine) as session:
        for entry in SERVICES:
            service_id = _service_id(str(entry["slug"]))
            service = session.get(Service, service_id)

            if service is None:
                session.add(
                    Service(
                        service_id=service_id,
                        name=str(entry["name"]),
                        description=str(entry["description"]),
                        is_active=True,
                    )
                )
                created += 1
            else:
                service.name = str(entry["name"])
                service.description = str(entry["description"])
                service.is_active = True
                session.add(service)
                updated += 1

        session.commit()

    return created, updated


if __name__ == "__main__":
    created, updated = seed_services()
    print(
        f"Seeded services: {created} created, {updated} updated "
        f"({len(SERVICES)} catalog entries)."
    )

"""add cms_content and testimonials tables with default seed

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-11-24 11:06:00.000000

"""
from datetime import datetime, timezone
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa

from models.cms import (
    DEFAULT_CLINIC_OVERVIEW,
    DEFAULT_IMPACT_NARRATIVE,
    DEFAULT_MISSION,
    DEFAULT_TESTIMONIALS,
    DEFAULT_VISION,
)

# revision identifiers, used by Alembic.
revision: str = "c9d0e1f2a3b4"
down_revision: Union[str, Sequence[str], None] = "b8c9d0e1f2a3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "cms_content",
        sa.Column("cms_id", sa.Uuid(), nullable=False),
        sa.Column("vision", sa.String(), nullable=False),
        sa.Column("mission", sa.String(), nullable=False),
        sa.Column("clinic_overview", sa.String(), nullable=False),
        sa.Column("impact_narrative", sa.String(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("cms_id"),
    )
    op.create_table(
        "testimonials",
        sa.Column("testimonial_id", sa.Uuid(), nullable=False),
        sa.Column("quote", sa.String(), nullable=False),
        sa.Column("author_label", sa.String(), nullable=False),
        sa.Column("service_category", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("testimonial_id"),
    )

    now = datetime.now(timezone.utc)
    cms_table = sa.table(
        "cms_content",
        sa.column("cms_id", sa.Uuid()),
        sa.column("vision", sa.String()),
        sa.column("mission", sa.String()),
        sa.column("clinic_overview", sa.String()),
        sa.column("impact_narrative", sa.String()),
        sa.column("updated_at", sa.DateTime(timezone=True)),
    )
    op.bulk_insert(
        cms_table,
        [
            {
                "cms_id": uuid.UUID("c1111111-1111-4111-8111-111111111101"),
                "vision": DEFAULT_VISION,
                "mission": DEFAULT_MISSION,
                "clinic_overview": DEFAULT_CLINIC_OVERVIEW,
                "impact_narrative": DEFAULT_IMPACT_NARRATIVE,
                "updated_at": now,
            }
        ],
    )

    testimonials_table = sa.table(
        "testimonials",
        sa.column("testimonial_id", sa.Uuid()),
        sa.column("quote", sa.String()),
        sa.column("author_label", sa.String()),
        sa.column("service_category", sa.String()),
        sa.column("is_active", sa.Boolean()),
        sa.column("display_order", sa.Integer()),
        sa.column("created_at", sa.DateTime(timezone=True)),
    )
    op.bulk_insert(
        testimonials_table,
        [
            {
                "testimonial_id": item["testimonial_id"],
                "quote": item["quote"],
                "author_label": item["author_label"],
                "service_category": item["service_category"],
                "is_active": item["is_active"],
                "display_order": item["display_order"],
                "created_at": now,
            }
            for item in DEFAULT_TESTIMONIALS
        ],
    )


def downgrade() -> None:
    op.drop_table("testimonials")
    op.drop_table("cms_content")

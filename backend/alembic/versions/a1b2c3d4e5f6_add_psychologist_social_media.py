"""add psychologist social media links

Revision ID: a1b2c3d4e5f6
Revises: c4f1a2b3d4e5
Create Date: 2026-10-23 16:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "c4f1a2b3d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add the JSON list of professional social media links."""
    op.add_column(
        "psychologist_profiles",
        sa.Column(
            "social_media_links",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'[]'"),
        ),
    )
    op.alter_column(
        "psychologist_profiles", "social_media_links", server_default=None
    )


def downgrade() -> None:
    """Drop the social media links."""
    op.drop_column("psychologist_profiles", "social_media_links")

"""add service duration and guardrail metadata

Revision ID: c4f1a2b3d4e5
Revises: f3a9c2d14b7e
Create Date: 2026-10-23 15:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = "c4f1a2b3d4e5"
down_revision: Union[str, Sequence[str], None] = "f3a9c2d14b7e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "services",
        sa.Column(
            "duration_minutes",
            sa.Integer(),
            nullable=False,
            server_default="60",
        ),
    )
    op.add_column(
        "services",
        sa.Column(
            "guardrail_notice",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=True,
        ),
    )
    op.alter_column("services", "duration_minutes", server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("services", "guardrail_notice")
    op.drop_column("services", "duration_minutes")

"""remove psychologist approval status

Approval is no longer a separate step: psychologists are created by an admin
promotion, so the profile row no longer carries verification metadata.

Revision ID: b6f2c9d81a34
Revises: a1b2c3d4e5f6
Create Date: 2026-10-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

import sqlmodel


# revision identifiers, used by Alembic.
revision: str = "b6f2c9d81a34"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Drop the psychologist approval columns."""
    op.drop_column("psychologist_profiles", "approval_status")
    op.drop_column("psychologist_profiles", "approved_by")
    op.drop_column("psychologist_profiles", "approved_at")


def downgrade() -> None:
    """Restore the approval columns (existing rows default to pending)."""
    op.add_column(
        "psychologist_profiles",
        sa.Column(
            "approval_status",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=False,
            server_default="pending",
        ),
    )
    op.add_column(
        "psychologist_profiles",
        sa.Column("approved_by", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "psychologist_profiles",
        sa.Column("approved_at", sa.DateTime(), nullable=True),
    )
    op.create_foreign_key(
        "fk_psychologist_profiles_approved_by_admin_profiles",
        "psychologist_profiles",
        "admin_profiles",
        ["approved_by"],
        ["admin_id"],
    )

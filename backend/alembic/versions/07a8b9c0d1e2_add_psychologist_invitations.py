"""add psychologist_invitations table

Revision ID: 07a8b9c0d1e2
Revises: f6a7b8c9d0e1
Create Date: 2026-11-22 19:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "07a8b9c0d1e2"
down_revision: Union[str, Sequence[str], None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "psychologist_invitations",
        sa.Column("invitation_id", sa.Uuid(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("token_hash", sa.String(), nullable=False),
        sa.Column("invited_by", sa.Uuid(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["invited_by"], ["users.user_id"]),
        sa.PrimaryKeyConstraint("invitation_id"),
    )
    op.create_index(
        "ix_psychologist_invitations_email",
        "psychologist_invitations",
        ["email"],
        unique=False,
    )
    op.create_index(
        "ix_psychologist_invitations_token_hash",
        "psychologist_invitations",
        ["token_hash"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_psychologist_invitations_token_hash",
        table_name="psychologist_invitations",
    )
    op.drop_index(
        "ix_psychologist_invitations_email",
        table_name="psychologist_invitations",
    )
    op.drop_table("psychologist_invitations")

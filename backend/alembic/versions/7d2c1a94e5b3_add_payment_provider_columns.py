"""add payment provider columns + created_at to payments

Revision ID: 7d2c1a94e5b3
Revises: 3891f62d8810
Create Date: 2026-10-14

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '7d2c1a94e5b3'
down_revision: Union[str, Sequence[str], None] = '3891f62d8810'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "payments",
        sa.Column("provider", sa.String(), nullable=False,
                  server_default="fake"),
    )
    op.add_column(
        "payments",
        sa.Column("provider_ref", sa.String(), nullable=True),
    )
    op.create_index("ix_payments_provider_ref", "payments", ["provider_ref"])
    op.add_column(
        "payments",
        sa.Column("checkout_url", sa.String(), nullable=True),
    )
    op.add_column(
        "payments",
        sa.Column("created_at", sa.DateTime(), nullable=False,
                  server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_column("payments", "created_at")
    op.drop_column("payments", "checkout_url")
    op.drop_index("ix_payments_provider_ref", table_name="payments")
    op.drop_column("payments", "provider_ref")
    op.drop_column("payments", "provider")

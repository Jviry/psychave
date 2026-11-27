"""add reminder/SLA columns and cms_content.evaluation_form_url

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Create Date: 2026-11-26 20:16:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f3a4b5c6d7e8"
down_revision: Union[str, Sequence[str], None] = "e2f3a4b5c6d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("appointments", sa.Column("reminder_24h_sent_at", sa.DateTime(), nullable=True))
    op.add_column("appointments", sa.Column("reminder_1h_sent_at", sa.DateTime(), nullable=True))
    op.add_column("appointments", sa.Column("sla_24h_alerted_at", sa.DateTime(), nullable=True))
    op.add_column("appointments", sa.Column("sla_48h_alerted_at", sa.DateTime(), nullable=True))
    op.add_column("cms_content", sa.Column("evaluation_form_url", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("cms_content", "evaluation_form_url")
    op.drop_column("appointments", "sla_48h_alerted_at")
    op.drop_column("appointments", "sla_24h_alerted_at")
    op.drop_column("appointments", "reminder_1h_sent_at")
    op.drop_column("appointments", "reminder_24h_sent_at")

"""normalize scheduling enum storage values

Enum-typed columns persist SQLAlchemy member names (uppercase), matching
``appointments.status`` and ``payments.status``. The original scheduling
migration wrote API values (lowercase) into those columns, which makes
SQLAlchemy's Enum result processor raise ``LookupError`` on read.

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-11-04 00:00:00.000000

"""

from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "e5f6a7b8c9d0"
down_revision: Union[str, Sequence[str], None] = "d4e5f6a7b8c9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Normalize enum columns to SQLAlchemy member names."""
    op.execute(
        """
        UPDATE proposed_slots
        SET proposed_by = CASE lower(proposed_by)
                WHEN 'client' THEN 'CLIENT'
                WHEN 'psychologist' THEN 'PSYCHOLOGIST'
                ELSE proposed_by
            END,
            status = CASE lower(status)
                WHEN 'proposed' THEN 'PROPOSED'
                WHEN 'accepted' THEN 'ACCEPTED'
                WHEN 'declined' THEN 'DECLINED'
                WHEN 'expired' THEN 'EXPIRED'
                ELSE status
            END
        """
    )

    op.execute(
        """
        UPDATE appointments
        SET status = CASE lower(status)
                WHEN 'pending' THEN 'PENDING'
                WHEN 'awaiting_schedule' THEN 'AWAITING_SCHEDULE'
                WHEN 'awaiting_slot_selection' THEN 'AWAITING_SCHEDULE'
                WHEN 'awaiting_payment' THEN 'AWAITING_PAYMENT'
                WHEN 'confirmed' THEN 'CONFIRMED'
                WHEN 'completed' THEN 'COMPLETED'
                WHEN 'cancelled' THEN 'CANCELLED'
                ELSE status
            END,
            scheduling_turn = CASE lower(scheduling_turn)
                WHEN 'client' THEN 'CLIENT'
                WHEN 'psychologist' THEN 'PSYCHOLOGIST'
                ELSE scheduling_turn
            END
        """
    )

    op.execute(
        """
        UPDATE payments
        SET status = CASE lower(status)
                WHEN 'pending' THEN 'PENDING'
                WHEN 'paid' THEN 'PAID'
                WHEN 'failed' THEN 'FAILED'
                ELSE status
            END
        """
    )

    op.alter_column(
        "proposed_slots",
        "proposed_by",
        server_default="PSYCHOLOGIST",
    )
    op.alter_column(
        "proposed_slots",
        "status",
        server_default="PROPOSED",
    )


def downgrade() -> None:
    """Data normalization is intentionally not reversed."""
    pass

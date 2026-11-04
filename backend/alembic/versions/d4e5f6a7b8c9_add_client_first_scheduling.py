"""client-first scheduling

The client now proposes preferred schedules at booking time. A psychologist
either accepts one of those slots or offers one alternative. Both sides must
agree before the payment step, and agreed slots carry a payment deadline.

Revision ID: d4e5f6a7b8c9
Revises: b6f2c9d81a34
Create Date: 2026-11-03 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "b6f2c9d81a34"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add scheduling negotiation state and client/psychologist slot metadata."""
    op.add_column(
        "appointments",
        sa.Column("scheduling_turn", sa.String(), nullable=True),
    )
    op.add_column(
        "appointments",
        sa.Column(
            "scheduling_round",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
    )
    op.add_column(
        "appointments",
        sa.Column("payment_deadline", sa.DateTime(), nullable=True),
    )

    op.add_column(
        "proposed_slots",
        sa.Column(
            "proposed_by",
            sa.String(),
            nullable=False,
            server_default="PSYCHOLOGIST",
        ),
    )
    op.add_column(
        "proposed_slots",
        sa.Column(
            "status",
            sa.String(),
            nullable=False,
            server_default="PROPOSED",
        ),
    )
    op.add_column(
        "proposed_slots",
        sa.Column(
            "round",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
    )

    # Legacy compatibility: the old flow was psychologist-proposes, client
    # selects. Map it onto the new state with the turn on the client side.
    # Enum-typed columns persist SQLAlchemy member names (uppercase), matching
    # appointments.status and payments.status.
    op.execute(
        "UPDATE appointments "
        "SET status = 'AWAITING_SCHEDULE', scheduling_turn = 'CLIENT' "
        "WHERE status IN ('awaiting_slot_selection', 'AWAITING_SLOT_SELECTION')"
    )

    # Any previously selected slot becomes the accepted agreement; the rest of
    # that round are declined.
    op.execute(
        "UPDATE proposed_slots SET status = 'DECLINED' "
        "WHERE status IN ('proposed', 'PROPOSED') AND appointment_id IN ("
        "  SELECT appointment_id FROM appointments "
        "  WHERE selected_slot_id IS NOT NULL"
        ")"
    )
    op.execute(
        "UPDATE proposed_slots SET status = 'ACCEPTED' "
        "WHERE slot_id IN ("
        "  SELECT selected_slot_id FROM appointments "
        "  WHERE selected_slot_id IS NOT NULL"
        ")"
    )


def downgrade() -> None:
    """Drop scheduling negotiation state and restore the legacy status name."""
    op.execute(
        "UPDATE appointments SET status = 'AWAITING_SLOT_SELECTION' "
        "WHERE status = 'AWAITING_SCHEDULE'"
    )

    op.drop_column("proposed_slots", "round")
    op.drop_column("proposed_slots", "status")
    op.drop_column("proposed_slots", "proposed_by")
    op.drop_column("appointments", "payment_deadline")
    op.drop_column("appointments", "scheduling_round")
    op.drop_column("appointments", "scheduling_turn")

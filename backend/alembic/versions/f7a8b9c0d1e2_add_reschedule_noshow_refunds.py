"""add reschedule, no-show, and partial refund fields

Revision ID: f7a8b9c0d1e2
Revises: f3a4b5c6d7e8
Create Date: 2026-11-26 16:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f7a8b9c0d1e2"
down_revision: Union[str, Sequence[str], None] = "f3a4b5c6d7e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        has_appt_enum = bind.execute(
            sa.text("SELECT 1 FROM pg_type WHERE typname = 'appointmentstatus'")
        ).scalar()
        has_pay_enum = bind.execute(
            sa.text("SELECT 1 FROM pg_type WHERE typname = 'paymentstatus'")
        ).scalar()
        if has_appt_enum or has_pay_enum:
            with op.get_context().autocommit_block():
                if has_appt_enum:
                    for val in (
                        "RESCHEDULE_REQUESTED",
                        "NO_SHOW",
                        "REFUNDED",
                        "PARTIALLY_REFUNDED",
                    ):
                        op.execute(
                            f"ALTER TYPE appointmentstatus ADD VALUE IF NOT EXISTS '{val}'"
                        )
                if has_pay_enum:
                    for val in ("REFUNDED", "PARTIALLY_REFUNDED"):
                        op.execute(
                            f"ALTER TYPE paymentstatus ADD VALUE IF NOT EXISTS '{val}'"
                        )

    op.add_column(
        "appointments",
        sa.Column(
            "reschedule_fee_waived",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        "appointments",
        sa.Column("reschedule_requested_by", sa.String(), nullable=True),
    )
    op.add_column(
        "appointments",
        sa.Column("reschedule_reason", sa.String(), nullable=True),
    )
    op.add_column(
        "appointments",
        sa.Column("refund_amount_centavos", sa.Integer(), nullable=True),
    )
    op.add_column(
        "appointments",
        sa.Column("refund_reason", sa.String(), nullable=True),
    )
    op.add_column(
        "appointments",
        sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "appointments",
        sa.Column("refunded_by", sa.Uuid(), nullable=True),
    )

    op.add_column(
        "payments",
        sa.Column(
            "payment_type",
            sa.String(),
            nullable=False,
            server_default="SESSION",
        ),
    )
    op.add_column(
        "payments",
        sa.Column("gateway_payment_id", sa.String(), nullable=True),
    )
    op.add_column(
        "payments",
        sa.Column("refund_amount_centavos", sa.Integer(), nullable=True),
    )
    op.add_column(
        "payments",
        sa.Column("refund_ref", sa.String(), nullable=True),
    )
    op.add_column(
        "payments",
        sa.Column("refund_reason", sa.String(), nullable=True),
    )
    op.add_column(
        "payments",
        sa.Column("refunded_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_payments_gateway_payment_id",
        "payments",
        ["gateway_payment_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_payments_gateway_payment_id", table_name="payments")
    op.drop_column("payments", "refunded_at")
    op.drop_column("payments", "refund_reason")
    op.drop_column("payments", "refund_ref")
    op.drop_column("payments", "refund_amount_centavos")
    op.drop_column("payments", "gateway_payment_id")
    op.drop_column("payments", "payment_type")

    op.drop_column("appointments", "refunded_by")
    op.drop_column("appointments", "refunded_at")
    op.drop_column("appointments", "refund_reason")
    op.drop_column("appointments", "refund_amount_centavos")
    op.drop_column("appointments", "reschedule_reason")
    op.drop_column("appointments", "reschedule_requested_by")
    op.drop_column("appointments", "reschedule_fee_waived")

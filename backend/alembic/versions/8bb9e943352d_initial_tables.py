"""initial tables

Revision ID: 8bb9e943352d
Revises:
Create Date: 2026-09-14 00:37:21.899700

"""

from typing import Sequence, Union

import sqlmodel
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "8bb9e943352d"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. users
    op.create_table(
        "users",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("cognito_sub", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("email", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("role", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.create_index(op.f("ix_users_cognito_sub"), "users", ["cognito_sub"], unique=True)

    # 2. admin_profiles (depends on users)
    op.create_table(
        "admin_profiles",
        sa.Column("admin_id", sa.Uuid(), nullable=False),
        sa.Column("full_name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.ForeignKeyConstraint(
            ["admin_id"],
            ["users.user_id"],
        ),
        sa.PrimaryKeyConstraint("admin_id"),
    )

    # 3. client_profiles (depends on users)
    op.create_table(
        "client_profiles",
        sa.Column("client_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["client_id"],
            ["users.user_id"],
        ),
        sa.PrimaryKeyConstraint("client_id"),
    )

    # 4. psychologist_profiles (depends on users, admin_profiles)
    op.create_table(
        "psychologist_profiles",
        sa.Column("psychologist_id", sa.Uuid(), nullable=False),
        sa.Column("full_name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("liscence_number", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("specialization", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column(
            "approval_status", sqlmodel.sql.sqltypes.AutoString(), nullable=False
        ),
        sa.Column("approved_by", sa.Uuid(), nullable=True),
        sa.Column("approved_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["approved_by"],
            ["admin_profiles.admin_id"],
        ),
        sa.ForeignKeyConstraint(
            ["psychologist_id"],
            ["users.user_id"],
        ),
        sa.PrimaryKeyConstraint("psychologist_id"),
    )

    # 5. persona (depends on client_profiles)
    op.create_table(
        "persona",
        sa.Column("persona_id", sa.Uuid(), nullable=False),
        sa.Column("full_name", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("client_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["client_id"],
            ["client_profiles.client_id"],
        ),
        sa.PrimaryKeyConstraint("persona_id"),
    )

    # 6. forms (depends on persona)
    op.create_table(
        "forms",
        sa.Column("form_id", sa.Uuid(), nullable=False),
        sa.Column("persona_id", sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(
            ["persona_id"],
            ["persona.persona_id"],
        ),
        sa.PrimaryKeyConstraint("form_id"),
    )

    # 7. appointments (depends on persona, psychologist_profiles)
    # selected_slot_id FK is added after proposed_slots is created due to circular reference
    op.create_table(
        "appointments",
        sa.Column("appointment_id", sa.Uuid(), nullable=False),
        sa.Column("persona_id", sa.Uuid(), nullable=False),
        sa.Column("selected_slot_id", sa.Uuid(), nullable=True),
        sa.Column("psychologist_id", sa.Uuid(), nullable=True),
        sa.Column("price", sa.Float(), nullable=True),
        sa.Column("requested_datetime", sa.DateTime(), nullable=True),
        sa.Column("status", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.ForeignKeyConstraint(
            ["persona_id"],
            ["persona.persona_id"],
        ),
        sa.ForeignKeyConstraint(
            ["psychologist_id"],
            ["psychologist_profiles.psychologist_id"],
        ),
        sa.PrimaryKeyConstraint("appointment_id"),
    )

    # 8. proposed_slots (depends on appointments)
    op.create_table(
        "proposed_slots",
        sa.Column("slot_id", sa.Uuid(), nullable=False),
        sa.Column("appointment_id", sa.Uuid(), nullable=False),
        sa.Column("session_date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=True),
        sa.ForeignKeyConstraint(
            ["appointment_id"],
            ["appointments.appointment_id"],
        ),
        sa.PrimaryKeyConstraint("slot_id"),
    )

    # Circular FK: appointments.selected_slot_id -> proposed_slots.slot_id
    op.create_foreign_key(
        "fk_appointments_selected_slot_id_proposed_slots",
        "appointments",
        "proposed_slots",
        ["selected_slot_id"],
        ["slot_id"],
    )

    # 9. payments (depends on appointments)
    op.create_table(
        "payments",
        sa.Column("payment_id", sa.Uuid(), nullable=False),
        sa.Column("appointment_id", sa.Uuid(), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("payment_method", sqlmodel.sql.sqltypes.AutoString(), nullable=True),
        sa.Column("status", sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column("paid_at", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(
            ["appointment_id"],
            ["appointments.appointment_id"],
        ),
        sa.PrimaryKeyConstraint("payment_id"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        "fk_appointments_selected_slot_id_proposed_slots",
        "appointments",
        type_="foreignkey",
    )
    op.drop_table("payments")
    op.drop_table("proposed_slots")
    op.drop_table("appointments")
    op.drop_table("forms")
    op.drop_table("persona")
    op.drop_table("psychologist_profiles")
    op.drop_table("client_profiles")
    op.drop_table("admin_profiles")
    op.drop_index(op.f("ix_users_cognito_sub"), table_name="users")
    op.drop_table("users")
    # ### end Alembic commands ###

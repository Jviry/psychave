"""rename persona table and columns to profile

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-11-15 17:38:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, Sequence[str], None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Rename persona table, columns, and enum type to profile(s)."""
    op.execute("ALTER TYPE personarelation RENAME TO profilerelation")
    op.rename_table("persona", "profiles")
    op.alter_column("profiles", "persona_id", new_column_name="profile_id")
    op.alter_column("profiles", "persona_name", new_column_name="profile_name")
    op.alter_column("forms", "persona_id", new_column_name="profile_id")
    op.alter_column("appointments", "persona_id", new_column_name="profile_id")
    op.execute(
        """
        WITH ranked_self_profiles AS (
            SELECT
                p.profile_id,
                FIRST_VALUE(p.profile_id) OVER (
                    PARTITION BY p.client_id
                    ORDER BY
                        (SELECT MAX(f.signed_at) FROM forms f WHERE f.profile_id = p.profile_id) DESC NULLS LAST,
                        p.profile_id ASC
                ) AS canonical_profile_id,
                ROW_NUMBER() OVER (
                    PARTITION BY p.client_id
                    ORDER BY
                        (SELECT MAX(f.signed_at) FROM forms f WHERE f.profile_id = p.profile_id) DESC NULLS LAST,
                        p.profile_id ASC
                ) AS rn
            FROM profiles p
            WHERE p.relation_to_account_holder = 'self_'
        ),
        duplicates AS (
            SELECT profile_id, canonical_profile_id
            FROM ranked_self_profiles
            WHERE rn > 1
        ),
        reassign_forms AS (
            UPDATE forms
            SET profile_id = d.canonical_profile_id
            FROM duplicates d
            WHERE forms.profile_id = d.profile_id
        ),
        reassign_appointments AS (
            UPDATE appointments
            SET profile_id = d.canonical_profile_id
            FROM duplicates d
            WHERE appointments.profile_id = d.profile_id
        )
        DELETE FROM profiles
        USING duplicates d
        WHERE profiles.profile_id = d.profile_id
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_one_self_per_client "
        "ON profiles (client_id) WHERE relation_to_account_holder = 'self_'"
    )


def downgrade() -> None:
    """Revert profile table, columns, and enum type back to persona."""
    op.execute("DROP INDEX IF EXISTS uq_profiles_one_self_per_client")
    op.alter_column("appointments", "profile_id", new_column_name="persona_id")
    op.alter_column("forms", "profile_id", new_column_name="persona_id")
    op.alter_column("profiles", "profile_name", new_column_name="persona_name")
    op.alter_column("profiles", "profile_id", new_column_name="persona_id")
    op.rename_table("profiles", "persona")
    op.execute("ALTER TYPE profilerelation RENAME TO personarelation")

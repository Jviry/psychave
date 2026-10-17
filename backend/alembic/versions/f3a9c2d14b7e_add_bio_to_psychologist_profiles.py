"""add bio, fix liscence_number misspelling, relax specialization

Revision ID: f3a9c2d14b7e
Revises: 7d2c1a94e5b3
Create Date: 2026-10-17 21:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

import sqlmodel

# revision identifiers, used by Alembic.
revision: str = 'f3a9c2d14b7e'
down_revision: Union[str, Sequence[str], None] = '7d2c1a94e5b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('psychologist_profiles', sa.Column(
        'bio', sqlmodel.sql.sqltypes.AutoString(), nullable=True))
    op.alter_column('psychologist_profiles', 'liscence_number',
                    new_column_name='license_number',
                    existing_type=sa.VARCHAR(), existing_nullable=True)
    op.alter_column('psychologist_profiles', 'specialization',
                    existing_type=sa.VARCHAR(), existing_nullable=False,
                    nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('psychologist_profiles', 'specialization',
                    existing_type=sa.VARCHAR(), existing_nullable=True,
                    nullable=False)
    op.alter_column('psychologist_profiles', 'license_number',
                    new_column_name='liscence_number',
                    existing_type=sa.VARCHAR(), existing_nullable=True)
    op.drop_column('psychologist_profiles', 'bio')

"""add consent_form_templates and convert profiles/forms non-core fields to json

Revision ID: a7b8c9d0e1f2
Revises: 07a8b9c0d1e2
Create Date: 2026-11-23 12:40:00.000000

"""
from datetime import datetime, timezone
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa
import sqlmodel

from src.models.consent_template import (
    DEFAULT_CONSENT_VERSION,
    DEFAULT_FINAL_CONSENT_STATEMENT,
    DEFAULT_INFORMED_CONSENT_TEXT,
    DEFAULT_OVERSEAS_ACK_TEXT,
    DEFAULT_OVERSEAS_LIMITATIONS_TEXT,
    DEFAULT_SCOPE_ACK_TEXT,
    DEFAULT_SCOPE_LIMITATIONS_TEXT,
    DEFAULT_TYPING_STATEMENT,
    build_default_wizard_pages,
)

# revision identifiers, used by Alembic.
revision: str = "a7b8c9d0e1f2"
down_revision: Union[str, Sequence[str], None] = "07a8b9c0d1e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_SEED_NAMESPACE = uuid.UUID("8f3c1d2a-5b6e-4f70-9a81-2c3d4e5f6071")

_PROFILE_MOVED_COLUMNS = (
    "occupation",
    "nationality",
    "permanent_address",
    "present_address",
    "contact_number",
    "preferred_contact_mode",
    "emergency_contact_name",
    "emergency_contact_relation",
    "emergency_contact_number",
)

_FORMS_MOVED_COLUMNS = (
    "terms_signer_name",
    "terms_signer_relation",
    "scope_acknowledged",
    "is_overseas_or_foreign",
    "overseas_acknowledged",
    "information_confirmed",
    "consent_signer_name",
)


def upgrade() -> None:
    """Create consent_form_templates and migrate profiles/forms non-core columns to JSON."""
    table = op.create_table(
        "consent_form_templates",
        sa.Column("template_id", sa.Uuid(), nullable=False),
        sa.Column(
            "consent_version",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=False,
        ),
        sa.Column(
            "informed_consent_text",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=False,
        ),
        sa.Column(
            "typing_statement",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=False,
        ),
        sa.Column(
            "scope_limitations_text",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=False,
        ),
        sa.Column(
            "scope_ack_text",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=False,
        ),
        sa.Column(
            "overseas_limitations_text",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=False,
        ),
        sa.Column(
            "overseas_ack_text",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=False,
        ),
        sa.Column(
            "final_consent_statement",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=False,
        ),
        sa.Column("wizard_pages", sa.JSON(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("template_id"),
    )
    op.create_index(
        op.f("ix_consent_form_templates_consent_version"),
        "consent_form_templates",
        ["consent_version"],
        unique=True,
    )

    now = datetime.now(timezone.utc)
    op.bulk_insert(
        table,
        [
            {
                "template_id": uuid.uuid5(
                    _SEED_NAMESPACE, f"consent-template-{DEFAULT_CONSENT_VERSION}"
                ),
                "consent_version": DEFAULT_CONSENT_VERSION,
                "informed_consent_text": DEFAULT_INFORMED_CONSENT_TEXT,
                "typing_statement": DEFAULT_TYPING_STATEMENT,
                "scope_limitations_text": DEFAULT_SCOPE_LIMITATIONS_TEXT,
                "scope_ack_text": DEFAULT_SCOPE_ACK_TEXT,
                "overseas_limitations_text": DEFAULT_OVERSEAS_LIMITATIONS_TEXT,
                "overseas_ack_text": DEFAULT_OVERSEAS_ACK_TEXT,
                "final_consent_statement": DEFAULT_FINAL_CONSENT_STATEMENT,
                "wizard_pages": build_default_wizard_pages(),
                "is_active": True,
                "created_at": now,
                "updated_at": now,
            }
        ],
    )

    # 1. Migrate profiles non-core columns into profiles.details JSON
    op.add_column(
        "profiles",
        sa.Column(
            "details",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
    )
    op.execute(
        """
        UPDATE profiles
        SET details = json_build_object(
            'occupation', occupation,
            'nationality', nationality,
            'permanent_address', permanent_address,
            'present_address', present_address,
            'contact_number', contact_number,
            'preferred_contact_mode', lower(preferred_contact_mode::text),
            'emergency_contact_name', emergency_contact_name,
            'emergency_contact_relation', emergency_contact_relation,
            'emergency_contact_number', emergency_contact_number
        )
        """
    )
    op.alter_column("profiles", "details", server_default=None)
    for col in _PROFILE_MOVED_COLUMNS:
        op.drop_column("profiles", col)

    # 2. Migrate forms consent columns into forms.responses JSON
    op.add_column(
        "forms",
        sa.Column(
            "responses",
            sa.JSON(),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
    )
    op.execute(
        """
        UPDATE forms
        SET responses = json_build_object(
            'terms_signer_name', terms_signer_name,
            'terms_signer_relation', terms_signer_relation,
            'scope_acknowledged', scope_acknowledged,
            'is_overseas_or_foreign', is_overseas_or_foreign,
            'overseas_acknowledged', overseas_acknowledged,
            'information_confirmed', information_confirmed,
            'consent_signer_name', consent_signer_name
        )
        """
    )
    op.alter_column("forms", "responses", server_default=None)
    for col in _FORMS_MOVED_COLUMNS:
        op.drop_column("forms", col)


def downgrade() -> None:
    """Restore profiles and forms columns and drop consent_form_templates."""
    # 1. Restore forms columns
    op.add_column(
        "forms",
        sa.Column(
            "terms_signer_name",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=False,
            server_default="",
        ),
    )
    op.add_column(
        "forms",
        sa.Column(
            "terms_signer_relation",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=False,
            server_default="self",
        ),
    )
    op.add_column(
        "forms",
        sa.Column(
            "scope_acknowledged",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    op.add_column(
        "forms",
        sa.Column(
            "is_overseas_or_foreign",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "forms",
        sa.Column(
            "overseas_acknowledged",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "forms",
        sa.Column(
            "information_confirmed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
        ),
    )
    op.add_column(
        "forms",
        sa.Column(
            "consent_signer_name",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=False,
            server_default="",
        ),
    )
    op.execute(
        """
        UPDATE forms
        SET terms_signer_name = COALESCE(responses->>'terms_signer_name', ''),
            terms_signer_relation = COALESCE(responses->>'terms_signer_relation', 'self'),
            scope_acknowledged = COALESCE((responses->>'scope_acknowledged')::boolean, true),
            is_overseas_or_foreign = COALESCE((responses->>'is_overseas_or_foreign')::boolean, false),
            overseas_acknowledged = COALESCE((responses->>'overseas_acknowledged')::boolean, false),
            information_confirmed = COALESCE((responses->>'information_confirmed')::boolean, true),
            consent_signer_name = COALESCE(responses->>'consent_signer_name', '')
        """
    )
    for col in _FORMS_MOVED_COLUMNS:
        op.alter_column("forms", col, server_default=None)
    op.drop_column("forms", "responses")

    # 2. Restore profiles columns
    op.add_column(
        "profiles",
        sa.Column(
            "occupation",
            sqlmodel.sql.sqltypes.AutoString(),
            nullable=True,
        ),
    )
    for col in (
        "nationality",
        "permanent_address",
        "present_address",
        "contact_number",
        "emergency_contact_name",
        "emergency_contact_relation",
        "emergency_contact_number",
    ):
        op.add_column(
            "profiles",
            sa.Column(
                col,
                sqlmodel.sql.sqltypes.AutoString(),
                nullable=False,
                server_default="",
            ),
        )
    op.add_column(
        "profiles",
        sa.Column(
            "preferred_contact_mode",
            sa.Enum("phone", "email", "messenger", "instagram", name="contactmode"),
            nullable=False,
            server_default="phone",
        ),
    )
    op.execute(
        """
        UPDATE profiles
        SET occupation = details->>'occupation',
            nationality = COALESCE(details->>'nationality', ''),
            permanent_address = COALESCE(details->>'permanent_address', ''),
            present_address = COALESCE(details->>'present_address', ''),
            contact_number = COALESCE(details->>'contact_number', ''),
            emergency_contact_name = COALESCE(details->>'emergency_contact_name', ''),
            emergency_contact_relation = COALESCE(details->>'emergency_contact_relation', ''),
            emergency_contact_number = COALESCE(details->>'emergency_contact_number', '')
        """
    )
    for col in (
        "nationality",
        "permanent_address",
        "present_address",
        "contact_number",
        "preferred_contact_mode",
        "emergency_contact_name",
        "emergency_contact_relation",
        "emergency_contact_number",
    ):
        op.alter_column("profiles", col, server_default=None)
    op.drop_column("profiles", "details")

    # 3. Drop consent_form_templates
    op.drop_index(
        op.f("ix_consent_form_templates_consent_version"),
        table_name="consent_form_templates",
    )
    op.drop_table("consent_form_templates")

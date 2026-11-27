"""split profile_name into first_name and last_name in consent_form_templates

Revision ID: b9c0d1e2f3a4
Revises: f7a8b9c0d1e2
Create Date: 2026-11-27 22:50:00.000000

"""
from copy import deepcopy
import json
from typing import Any, Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b9c0d1e2f3a4"
down_revision: Union[str, Sequence[str], None] = "f7a8b9c0d1e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FIRST_NAME_BLOCK: dict[str, Any] = {
    "block_id": "first_name",
    "type": "text",
    "label": "First name",
    "content": None,
    "helper_text": None,
    "placeholder": "Enter first name",
    "target": "profile",
    "field_key": "first_name",
    "applies_to": "all",
    "required": True,
    "options": [],
    "show_if": None,
    "system_locked": True,
}

LAST_NAME_BLOCK: dict[str, Any] = {
    "block_id": "last_name",
    "type": "text",
    "label": "Last name",
    "content": None,
    "helper_text": None,
    "placeholder": "Enter last name",
    "target": "profile",
    "field_key": "last_name",
    "applies_to": "all",
    "required": True,
    "options": [],
    "show_if": None,
    "system_locked": True,
}

PROFILE_NAME_BLOCK: dict[str, Any] = {
    "block_id": "profile_name",
    "type": "text",
    "label": "Full name",
    "content": None,
    "helper_text": None,
    "placeholder": "Enter full name",
    "target": "profile",
    "field_key": "profile_name",
    "applies_to": "all",
    "required": True,
    "options": [],
    "show_if": None,
    "system_locked": True,
}


def _split_pages(pages: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], bool]:
    changed = False
    new_pages = deepcopy(pages)
    existing_keys = {
        b.get("field_key")
        for p in new_pages
        for b in (p.get("blocks") or [])
        if b.get("field_key")
    }
    if "first_name" in existing_keys and "last_name" in existing_keys:
        return new_pages, False

    for page in new_pages:
        blocks = page.get("blocks") or []
        updated_blocks: list[dict[str, Any]] = []
        for block in blocks:
            if (
                block.get("field_key") == "profile_name"
                or block.get("block_id") == "profile_name"
            ):
                updated_blocks.append(deepcopy(FIRST_NAME_BLOCK))
                updated_blocks.append(deepcopy(LAST_NAME_BLOCK))
                changed = True
            else:
                updated_blocks.append(block)
        page["blocks"] = updated_blocks
    return new_pages, changed


def _merge_pages(pages: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], bool]:
    changed = False
    new_pages = deepcopy(pages)
    for page in new_pages:
        blocks = page.get("blocks") or []
        updated_blocks: list[dict[str, Any]] = []
        inserted_profile_name = False
        for block in blocks:
            key = block.get("field_key") or block.get("block_id")
            if key in ("first_name", "last_name"):
                if not inserted_profile_name:
                    updated_blocks.append(deepcopy(PROFILE_NAME_BLOCK))
                    inserted_profile_name = True
                changed = True
            else:
                updated_blocks.append(block)
        page["blocks"] = updated_blocks
    return new_pages, changed


def _migrate_templates(transform) -> None:
    bind = op.get_bind()
    rows = bind.execute(
        sa.text("SELECT template_id, wizard_pages FROM consent_form_templates")
    ).fetchall()
    for template_id, raw_pages in rows:
        if raw_pages is None:
            continue
        pages = (
            json.loads(raw_pages) if isinstance(raw_pages, str) else raw_pages
        )
        if not isinstance(pages, list):
            continue
        updated_pages, changed = transform(pages)
        if not changed:
            continue
        bind.execute(
            sa.text(
                "UPDATE consent_form_templates SET wizard_pages = :pages WHERE template_id = :tid"
            ),
            {
                "pages": json.dumps(updated_pages),
                "tid": template_id,
            },
        )


def upgrade() -> None:
    _migrate_templates(_split_pages)


def downgrade() -> None:
    _migrate_templates(_merge_pages)

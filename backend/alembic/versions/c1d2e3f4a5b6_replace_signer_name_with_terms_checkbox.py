"""replace signer name inputs with informed consent checkbox in consent_form_templates

Revision ID: c1d2e3f4a5b6
Revises: b9c0d1e2f3a4
Create Date: 2026-11-28 01:56:00.000000

"""
from copy import deepcopy
import json
from typing import Any, Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c1d2e3f4a5b6"
down_revision: Union[str, Sequence[str], None] = "b9c0d1e2f3a4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_TERMS_AGREED_LABEL = (
    "I have read, understood, and voluntarily agree to the Informed Consent "
    "and Data Privacy Agreement stated above."
)

OLD_TYPING_STATEMENT = (
    "By typing your full name in the designated field, you confirm that you have "
    "read, understood, and voluntarily agreed to the terms stated above. If filling "
    "out for a minor, write your full name and relation to the client."
)

NEW_FINAL_CONSENT_STATEMENT = (
    "By submitting this form, I confirm that I have read and understood the "
    "description, purpose, scope, limitations, confidentiality, data privacy "
    "provisions, and ethical boundaries of the psychological service I am availing."
)

OLD_FINAL_CONSENT_STATEMENT = (
    "By typing my full name below, I confirm that I have read and understood the "
    "description, purpose, scope, limitations, confidentiality, data privacy "
    "provisions, and ethical boundaries of the psychological service I am availing."
)

TERMS_AGREED_BLOCK: dict[str, Any] = {
    "block_id": "terms_agreed",
    "type": "checkbox",
    "label": NEW_TERMS_AGREED_LABEL,
    "content": None,
    "helper_text": None,
    "placeholder": None,
    "target": "consent",
    "field_key": "terms_agreed",
    "applies_to": "all",
    "required": True,
    "options": [],
    "show_if": None,
    "system_locked": False,
}

TERMS_SIGNER_NAME_BLOCK: dict[str, Any] = {
    "block_id": "terms_signer_name",
    "type": "text",
    "label": "Signer full name (typed signature)",
    "content": None,
    "helper_text": OLD_TYPING_STATEMENT,
    "placeholder": "Type full name",
    "target": "consent",
    "field_key": "terms_signer_name",
    "applies_to": "all",
    "required": True,
    "options": [],
    "show_if": None,
    "system_locked": False,
}

CONSENT_SIGNER_NAME_BLOCK: dict[str, Any] = {
    "block_id": "consent_signer_name",
    "type": "text",
    "label": "Final consent signer full name",
    "content": None,
    "helper_text": None,
    "placeholder": "Type full name to sign",
    "target": "consent",
    "field_key": "consent_signer_name",
    "applies_to": "all",
    "required": True,
    "options": [],
    "show_if": None,
    "system_locked": False,
}


def _upgrade_pages(pages: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], bool]:
    changed = False
    new_pages = deepcopy(pages)
    has_terms_agreed = any(
        b.get("field_key") == "terms_agreed" or b.get("block_id") == "terms_agreed"
        for p in new_pages
        for b in (p.get("blocks") or [])
    )

    for page in new_pages:
        blocks = page.get("blocks") or []
        updated_blocks: list[dict[str, Any]] = []
        for block in blocks:
            key = block.get("field_key") or block.get("block_id")
            if key == "terms_signer_name":
                if not has_terms_agreed:
                    updated_blocks.append(deepcopy(TERMS_AGREED_BLOCK))
                    has_terms_agreed = True
                changed = True
                continue
            if key == "consent_signer_name":
                changed = True
                continue
            if block.get("block_id") == "final_consent_doc":
                content = str(block.get("content") or "")
                if content.startswith("By typing my full name below,"):
                    block = {
                        **block,
                        "content": NEW_FINAL_CONSENT_STATEMENT,
                    }
                    changed = True
            updated_blocks.append(block)
        page["blocks"] = updated_blocks
    return new_pages, changed


def _downgrade_pages(pages: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], bool]:
    changed = False
    new_pages = deepcopy(pages)
    for page in new_pages:
        blocks = page.get("blocks") or []
        updated_blocks: list[dict[str, Any]] = []
        for block in blocks:
            key = block.get("field_key") or block.get("block_id")
            if key == "terms_agreed":
                updated_blocks.append(deepcopy(TERMS_SIGNER_NAME_BLOCK))
                changed = True
                continue
            if block.get("block_id") == "final_consent_doc":
                content = str(block.get("content") or "")
                if content.startswith("By submitting this form,"):
                    block = {
                        **block,
                        "content": OLD_FINAL_CONSENT_STATEMENT,
                    }
                    changed = True
                updated_blocks.append(block)
                updated_blocks.append(deepcopy(CONSENT_SIGNER_NAME_BLOCK))
                changed = True
                continue
            updated_blocks.append(block)
        page["blocks"] = updated_blocks
    return new_pages, changed


def _migrate_templates(transform, new_typing: str, new_final: str, old_prefix: str) -> None:
    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            "SELECT template_id, wizard_pages, typing_statement, final_consent_statement "
            "FROM consent_form_templates"
        )
    ).fetchall()
    for template_id, raw_pages, typing_stmt, final_stmt in rows:
        if raw_pages is None:
            continue
        pages = json.loads(raw_pages) if isinstance(raw_pages, str) else raw_pages
        if not isinstance(pages, list):
            continue
        updated_pages, changed = transform(pages)

        next_typing = typing_stmt
        if isinstance(typing_stmt, str) and typing_stmt.startswith(old_prefix):
            next_typing = new_typing
            changed = True

        next_final = final_stmt
        if isinstance(final_stmt, str) and final_stmt.startswith(old_prefix):
            next_final = new_final
            changed = True

        if not changed:
            continue

        bind.execute(
            sa.text(
                "UPDATE consent_form_templates "
                "SET wizard_pages = :pages, "
                "    typing_statement = :typing_stmt, "
                "    final_consent_statement = :final_stmt "
                "WHERE template_id = :tid"
            ),
            {
                "pages": json.dumps(updated_pages),
                "typing_stmt": next_typing,
                "final_stmt": next_final,
                "tid": template_id,
            },
        )


def upgrade() -> None:
    _migrate_templates(
        _upgrade_pages,
        NEW_TERMS_AGREED_LABEL,
        NEW_FINAL_CONSENT_STATEMENT,
        "By typing",
    )


def downgrade() -> None:
    _migrate_templates(
        _downgrade_pages,
        OLD_TYPING_STATEMENT,
        OLD_FINAL_CONSENT_STATEMENT,
        "I have read, understood, and voluntarily agree",
    )

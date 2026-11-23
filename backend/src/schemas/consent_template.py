from datetime import datetime
from enum import Enum
import re
from typing import Any, Literal
import uuid
from pydantic import field_validator, model_validator
from sqlmodel import Field, SQLModel

from models.consent_template import (
    DEFAULT_FINAL_CONSENT_STATEMENT,
    DEFAULT_INFORMED_CONSENT_TEXT,
    DEFAULT_OVERSEAS_ACK_TEXT,
    DEFAULT_OVERSEAS_LIMITATIONS_TEXT,
    DEFAULT_SCOPE_ACK_TEXT,
    DEFAULT_SCOPE_LIMITATIONS_TEXT,
    DEFAULT_TYPING_STATEMENT,
    build_default_wizard_pages,
)

REQUIRED_OPERATIONAL_KEYS = (
    "relation_to_account_holder",
    "date_of_birth",
    "socmed_platform",
    "socmed_username",
)
NAME_KEY_ALIASES = ("persona_name", "profile_name")


class WizardBlockType(str, Enum):
    SCROLLABLE_DOC = "scrollable_doc"
    INFO_TEXT = "info_text"
    SECTION_HEADING = "section_heading"
    SERVICES_LIST = "services_list"
    REVIEW_SUMMARY = "review_summary"
    TEXT = "text"
    TEXTAREA = "textarea"
    DATE = "date"
    PHONE = "phone"
    SELECT = "select"
    CHECKBOX = "checkbox"


INPUT_BLOCK_TYPES = {
    WizardBlockType.TEXT,
    WizardBlockType.TEXTAREA,
    WizardBlockType.DATE,
    WizardBlockType.PHONE,
    WizardBlockType.SELECT,
    WizardBlockType.CHECKBOX,
}


class WizardFieldTarget(str, Enum):
    PERSONA = "persona"
    PROFILE = "profile"
    CONSENT = "consent"
    UI = "ui"
    CUSTOM = "custom"


class WizardAppliesTo(str, Enum):
    ALL = "all"
    SELF = "self"
    DEPENDENT = "dependent"


class WizardSelectOption(SQLModel):
    value: str
    label: str


class WizardShowIf(SQLModel):
    field_key: str
    equals: str | bool


class WizardBlockSchema(SQLModel):
    block_id: str
    type: WizardBlockType
    label: str
    content: str | None = None
    helper_text: str | None = None
    placeholder: str | None = None
    target: WizardFieldTarget | None = None
    field_key: str | None = None
    applies_to: WizardAppliesTo = WizardAppliesTo.ALL
    required: bool = False
    options: list[WizardSelectOption] = Field(default_factory=list)
    show_if: WizardShowIf | None = None
    system_locked: bool = False

    @field_validator("block_id", "label")
    @classmethod
    def not_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Block id and label cannot be blank")
        return cleaned

    @model_validator(mode="after")
    def validate_block_rules(self):
        if self.type in INPUT_BLOCK_TYPES:
            if not self.field_key or not self.field_key.strip():
                raise ValueError(
                    f"Input block '{self.block_id}' must define a field_key"
                )
            self.field_key = self.field_key.strip()
            if self.target is None:
                self.target = WizardFieldTarget.CUSTOM
            if self.type == WizardBlockType.SELECT and not self.options:
                raise ValueError(
                    f"Select block '{self.block_id}' must define at least one option"
                )
        return self


class WizardPageSchema(SQLModel):
    page_id: str
    title: str
    description: str | None = None
    blocks: list[WizardBlockSchema]

    @field_validator("page_id", "title")
    @classmethod
    def not_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Page id and title cannot be blank")
        return cleaned

    @model_validator(mode="after")
    def validate_has_blocks(self):
        if not self.blocks:
            raise ValueError(
                f"Page '{self.page_id}' must contain at least one block"
            )
        return self


class ConsentFormTemplateRead(SQLModel):
    template_id: uuid.UUID
    consent_version: str
    informed_consent_text: str
    typing_statement: str
    scope_limitations_text: str
    scope_ack_text: str
    overseas_limitations_text: str
    overseas_ack_text: str
    final_consent_statement: str
    wizard_pages: list[WizardPageSchema]
    is_active: bool
    created_at: datetime
    updated_at: datetime


class ConsentFormTemplateUpsert(SQLModel):
    consent_version: str
    bump_type: Literal["auto", "minor", "major", "explicit"] = "auto"
    informed_consent_text: str = DEFAULT_INFORMED_CONSENT_TEXT
    typing_statement: str = DEFAULT_TYPING_STATEMENT
    scope_limitations_text: str = DEFAULT_SCOPE_LIMITATIONS_TEXT
    scope_ack_text: str = DEFAULT_SCOPE_ACK_TEXT
    overseas_limitations_text: str = DEFAULT_OVERSEAS_LIMITATIONS_TEXT
    overseas_ack_text: str = DEFAULT_OVERSEAS_ACK_TEXT
    final_consent_statement: str = DEFAULT_FINAL_CONSENT_STATEMENT
    wizard_pages: list[WizardPageSchema] | None = None

    @field_validator("consent_version")
    @classmethod
    def version_not_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("consent_version cannot be blank")
        return cleaned

    @model_validator(mode="after")
    def ensure_pages_and_operational_keys(self):
        if self.wizard_pages is None:
            raw_pages = build_default_wizard_pages(
                informed_consent_text=self.informed_consent_text.strip()
                or DEFAULT_INFORMED_CONSENT_TEXT,
                typing_statement=self.typing_statement.strip()
                or DEFAULT_TYPING_STATEMENT,
                scope_limitations_text=self.scope_limitations_text.strip()
                or DEFAULT_SCOPE_LIMITATIONS_TEXT,
                scope_ack_text=self.scope_ack_text.strip()
                or DEFAULT_SCOPE_ACK_TEXT,
                overseas_limitations_text=self.overseas_limitations_text.strip()
                or DEFAULT_OVERSEAS_LIMITATIONS_TEXT,
                overseas_ack_text=self.overseas_ack_text.strip()
                or DEFAULT_OVERSEAS_ACK_TEXT,
                final_consent_statement=self.final_consent_statement.strip()
                or DEFAULT_FINAL_CONSENT_STATEMENT,
            )
            self.wizard_pages = [
                WizardPageSchema.model_validate(p) for p in raw_pages
            ]

        if not self.wizard_pages:
            raise ValueError("wizard_pages must contain at least one page")

        page_ids: set[str] = set()
        block_ids: set[str] = set()
        field_keys: set[str] = set()

        for page in self.wizard_pages:
            if page.page_id in page_ids:
                raise ValueError(f"Duplicate page_id '{page.page_id}'")
            page_ids.add(page.page_id)

            for block in page.blocks:
                if block.block_id in block_ids:
                    raise ValueError(f"Duplicate block_id '{block.block_id}'")
                block_ids.add(block.block_id)

                if block.field_key:
                    if block.field_key in field_keys:
                        raise ValueError(
                            f"Duplicate field_key '{block.field_key}'"
                        )
                    field_keys.add(block.field_key)

                # Sync top-level legacy text fields from known blocks when present
                if block.block_id == "informed_consent_doc" and block.content:
                    self.informed_consent_text = block.content
                elif block.block_id == "terms_signer_name" and block.helper_text:
                    self.typing_statement = block.helper_text
                elif block.block_id == "scope_limitations_doc" and block.content:
                    self.scope_limitations_text = block.content
                elif block.block_id == "scope_acknowledged" and block.label:
                    self.scope_ack_text = block.label
                elif block.block_id == "overseas_limitations_doc" and block.content:
                    self.overseas_limitations_text = block.content
                elif block.block_id == "overseas_acknowledged" and block.label:
                    self.overseas_ack_text = block.label
                elif block.block_id == "final_consent_doc" and block.content:
                    self.final_consent_statement = block.content

        missing_keys = [
            key for key in REQUIRED_OPERATIONAL_KEYS if key not in field_keys
        ]
        if not any(alias in field_keys for alias in NAME_KEY_ALIASES):
            missing_keys.append("persona_name")

        if missing_keys:
            raise ValueError(
                f"Cannot remove required operational fields from wizard_pages: {', '.join(missing_keys)}"
            )

        return self


_VERSION_RE = re.compile(r"^([a-zA-Z]*)(\d+)(?:\.(\d+))?(.*)$")


def extract_major_version(version: str) -> str:
    """Return the major version token (e.g. 'v2', 'v2.0', 'v2.1' -> 'v2')."""
    cleaned = (version or "").strip()
    match = _VERSION_RE.match(cleaned)
    if not match:
        return cleaned.split(".")[0]
    prefix, major, _minor, suffix = match.groups()
    if suffix and not suffix.startswith("."):
        return f"{prefix}{major}{suffix}"
    return f"{prefix}{major}"


def next_minor_version(current_version: str, existing_versions: set[str]) -> str:
    """Increment the decimal minor version ('v2' -> 'v2.1' -> 'v2.2')."""
    cleaned = (current_version or "v2").strip()
    match = _VERSION_RE.match(cleaned)
    if not match:
        candidate_idx = 1
        while f"{cleaned}.{candidate_idx}" in existing_versions:
            candidate_idx += 1
        return f"{cleaned}.{candidate_idx}"

    prefix, major_str, minor_str, suffix = match.groups()
    minor = int(minor_str) + 1 if minor_str is not None else 1
    while True:
        candidate = f"{prefix}{major_str}.{minor}{suffix}"
        if candidate not in existing_versions:
            return candidate
        minor += 1


def next_major_version(current_version: str, existing_versions: set[str]) -> str:
    """Increment the major version ('v2' / 'v2.1' -> 'v3')."""
    cleaned = (current_version or "v2").strip()
    match = _VERSION_RE.match(cleaned)
    if not match:
        return f"{cleaned}-major"

    prefix, major_str, _minor_str, suffix = match.groups()
    major = int(major_str) + 1
    while True:
        candidate = f"{prefix}{major}{suffix}"
        if candidate not in existing_versions:
            return candidate
        major += 1


def _extract_consent_signature(pages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Extract normalized representation of all consent/legal blocks to detect consent changes."""
    signature: list[dict[str, Any]] = []
    for page in pages:
        for block in page.get("blocks", []):
            b_type = str(block.get("type", ""))
            b_target = str(block.get("target") or "")
            b_id = str(block.get("block_id", ""))
            is_consent_block = (
                b_target == WizardFieldTarget.CONSENT.value
                or b_type == WizardBlockType.SCROLLABLE_DOC.value
                or b_id == "final_consent_doc"
            )
            if is_consent_block:
                signature.append(
                    {
                        "block_id": b_id,
                        "type": b_type,
                        "field_key": block.get("field_key"),
                        "label": (block.get("label") or "").strip(),
                        "content": (block.get("content") or "").strip(),
                        "helper_text": (block.get("helper_text") or "").strip(),
                        "required": bool(block.get("required", False)),
                        "applies_to": block.get("applies_to", "all"),
                        "options": block.get("options") or [],
                        "show_if": block.get("show_if"),
                    }
                )
    return signature


def did_consent_blocks_change(
    old_pages: list[dict[str, Any]], new_pages: list[dict[str, Any]]
) -> bool:
    """Return True if any consent input block or legal scrollable document changed."""
    return _extract_consent_signature(old_pages) != _extract_consent_signature(
        new_pages
    )

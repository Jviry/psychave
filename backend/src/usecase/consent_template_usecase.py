from datetime import date
from typing import Any
from sqlmodel import Session

from common.exceptions import ConflictError, ValidationError
from models.consent_template import (
    ConsentFormTemplate,
    build_default_wizard_pages,
)
from models.profile import ProfileRelation
from repo.consent_template_repo import ConsentTemplateRepo
from schemas.consent_template import (
    ConsentFormTemplateUpsert,
    INPUT_BLOCK_TYPES,
    WizardAppliesTo,
    WizardBlockType,
    WizardFieldTarget,
    extract_major_version,
)
from schemas.profile import (
    ConsentCreate,
    MINOR_CUTOFF_AGE,
    ProfileCreate,
    ReviewFieldRead,
    ReviewSectionRead,
    _calculate_age,
)

_OPERATIONAL_COLUMN_KEYS = {
    "relation_to_account_holder",
    "persona_name",
    "profile_name",
    "date_of_birth",
    "socmed_platform",
    "socmed_username",
}


class ConsentTemplateUsecase:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ConsentTemplateRepo(db)

    def get_active_template(self) -> ConsentFormTemplate:
        return self.repo.ensure_default_seeded()

    def list_templates(self) -> list[ConsentFormTemplate]:
        self.repo.ensure_default_seeded()
        return self.repo.list_all()

    def update_active_template(
        self, payload: ConsentFormTemplateUpsert
    ) -> ConsentFormTemplate:
        return self.repo.upsert_active(payload)

    @staticmethod
    def _is_block_applicable(
        block: dict[str, Any],
        is_self: bool,
        context_values: dict[str, Any],
    ) -> bool:
        applies_to = str(block.get("applies_to") or WizardAppliesTo.ALL.value)
        if applies_to == WizardAppliesTo.SELF.value and not is_self:
            return False
        if applies_to == WizardAppliesTo.DEPENDENT.value and is_self:
            return False

        show_if = block.get("show_if")
        if show_if and isinstance(show_if, dict):
            cond_key = show_if.get("field_key")
            expected = show_if.get("equals")
            if cond_key:
                actual = context_values.get(cond_key)
                if actual != expected:
                    return False
        return True

    @classmethod
    def _validate_single_block_value(
        cls,
        block: dict[str, Any],
        value: Any,
    ) -> Any:
        field_key = str(block.get("field_key") or block.get("block_id"))
        label = str(block.get("label") or field_key)
        b_type = str(block.get("type") or "")
        required = bool(block.get("required", False))

        if b_type == WizardBlockType.CHECKBOX.value:
            if value is None:
                value = False
            if not isinstance(value, bool):
                raise ValidationError(
                    f"Field '{field_key}' ({label}) must be a boolean"
                )
            if required and value is not True:
                raise ValidationError(
                    f"Field '{field_key}' ({label}) acknowledgement is required"
                )
            return value

        # Non-checkbox input types
        is_empty = value is None or (
            isinstance(value, str) and not value.strip()
        )
        if is_empty:
            if required:
                raise ValidationError(
                    f"Field '{field_key}' ({label}) is required"
                )
            return value

        if b_type == WizardBlockType.DATE.value:
            if isinstance(value, date):
                return value.isoformat()
            if not isinstance(value, str):
                raise ValidationError(
                    f"Field '{field_key}' ({label}) must be an ISO date string"
                )
            try:
                date.fromisoformat(value.strip()[:10])
            except ValueError as exc:
                raise ValidationError(
                    f"Field '{field_key}' ({label}) must be a valid YYYY-MM-DD date"
                ) from exc
            return value.strip()

        if b_type == WizardBlockType.SELECT.value:
            str_val = value.value if hasattr(value, "value") else str(value)
            options = block.get("options") or []
            allowed_values = {str(opt.get("value", "")) for opt in options}
            if allowed_values and str_val not in allowed_values:
                raise ValidationError(
                    f"Field '{field_key}' ({label}) has invalid option '{str_val}'"
                )
            return str_val

        if b_type in (
            WizardBlockType.TEXT.value,
            WizardBlockType.TEXTAREA.value,
            WizardBlockType.PHONE.value,
        ):
            if not isinstance(value, str):
                raise ValidationError(
                    f"Field '{field_key}' ({label}) must be a string"
                )
            return value.strip()

        return value

    @classmethod
    def validate_wizard_submission(
        cls,
        wizard_pages: list[dict[str, Any]],
        active_version: str,
        profile_data: ProfileCreate,
        consent_data: ConsentCreate | None = None,
        validate_demographics: bool = True,
        validate_consent: bool = True,
    ) -> tuple[dict[str, Any], dict[str, Any], list[dict[str, Any]]]:
        """Validate submission against active wizard_pages and return (details, responses, review_sections)."""
        if validate_consent and consent_data is not None:
            submitted_major = extract_major_version(consent_data.consent_version)
            active_major = extract_major_version(active_version)
            if submitted_major != active_major:
                raise ConflictError(
                    f"Consent form is outdated — current version is {active_version}"
                )

        pages = wizard_pages or build_default_wizard_pages()
        rel_val = (
            profile_data.relation_to_account_holder.value
            if hasattr(profile_data.relation_to_account_holder, "value")
            else str(profile_data.relation_to_account_holder)
        )
        is_self = rel_val == ProfileRelation.self_.value

        details = profile_data.merged_details()
        responses = (
            consent_data.merged_responses() if consent_data is not None else {}
        )

        # Build unified lookup context for show_if & validation
        context: dict[str, Any] = {
            "whoFor": "myself" if is_self else "someone_else",
            "relation_to_account_holder": rel_val,
            "persona_name": profile_data.profile_name,
            "profile_name": profile_data.profile_name,
            "date_of_birth": profile_data.date_of_birth.isoformat(),
            "socmed_platform": profile_data.socmed_platform,
            "socmed_username": profile_data.socmed_username,
            **details,
            **responses,
        }

        present_required_keys: set[str] = set()
        present_keys: set[str] = set()
        review_sections: list[dict[str, Any]] = []

        for page in pages:
            section_fields: list[dict[str, Any]] = []
            for block in page.get("blocks", []):
                b_type = str(block.get("type") or "")
                if b_type not in {t.value for t in INPUT_BLOCK_TYPES}:
                    continue

                field_key = str(block.get("field_key") or "").strip()
                if not field_key:
                    continue

                b_target = str(
                    block.get("target") or WizardFieldTarget.CUSTOM.value
                )
                if b_target == WizardFieldTarget.UI.value:
                    continue

                if not cls._is_block_applicable(block, is_self, context):
                    continue

                present_keys.add(field_key)
                if block.get("required"):
                    present_required_keys.add(field_key)

                is_demographic = b_target in (
                    WizardFieldTarget.PERSONA.value,
                    WizardFieldTarget.PROFILE.value,
                )
                is_consent_or_custom = b_target in (
                    WizardFieldTarget.CONSENT.value,
                    WizardFieldTarget.CUSTOM.value,
                )

                raw_val = context.get(field_key)
                if (is_demographic and validate_demographics) or (
                    is_consent_or_custom and validate_consent
                ):
                    validated_val = cls._validate_single_block_value(
                        block, raw_val
                    )
                else:
                    validated_val = raw_val

                context[field_key] = validated_val
                if is_demographic and field_key not in _OPERATIONAL_COLUMN_KEYS:
                    if validated_val is not None:
                        details[field_key] = validated_val
                elif is_consent_or_custom:
                    if validated_val is not None:
                        responses[field_key] = validated_val

                section_fields.append(
                    {
                        "field_key": field_key,
                        "label": str(block.get("label") or field_key),
                        "type": b_type,
                        "value": validated_val,
                    }
                )

            if section_fields:
                review_sections.append(
                    {
                        "page_id": str(page.get("page_id") or ""),
                        "title": str(page.get("title") or ""),
                        "fields": section_fields,
                    }
                )

        if validate_consent and consent_data is not None:
            # Cross-field signer name match only when both blocks are active & present
            if (
                "terms_signer_name" in present_keys
                and "consent_signer_name" in present_keys
            ):
                t_name = str(responses.get("terms_signer_name") or "").strip().lower()
                c_name = str(responses.get("consent_signer_name") or "").strip().lower()
                if t_name and c_name and t_name != c_name:
                    raise ValidationError(
                        "Terms signer name and consent signer name must match"
                    )

            # Minor signer relation check when terms_signer_relation is present or minor rule applies
            is_minor = _calculate_age(profile_data.date_of_birth) < MINOR_CUTOFF_AGE
            signer_rel = str(
                responses.get("terms_signer_relation")
                or ("self" if is_self else "")
            ).strip()
            if is_minor and signer_rel == "self":
                raise ValidationError(
                    "A minor's consent cannot be signed as 'self' — provide the signer's relation"
                )

            responses["_review_sections"] = review_sections

        return details, responses, review_sections

    @classmethod
    def build_review_sections(
        cls,
        wizard_pages: list[dict[str, Any]] | None,
        profile: Any,
        form: Any,
    ) -> list[ReviewSectionRead]:
        raw_responses = dict(getattr(form, "responses", None) or {})
        frozen = raw_responses.get("_review_sections")
        if isinstance(frozen, list) and frozen:
            return [ReviewSectionRead.model_validate(s) for s in frozen]

        details = dict(getattr(profile, "details", None) or {})
        rel_val = (
            profile.relation_to_account_holder.value
            if hasattr(profile.relation_to_account_holder, "value")
            else str(profile.relation_to_account_holder)
        )
        is_self = rel_val == ProfileRelation.self_.value
        context: dict[str, Any] = {
            "whoFor": "myself" if is_self else "someone_else",
            "relation_to_account_holder": rel_val,
            "persona_name": profile.profile_name,
            "profile_name": profile.profile_name,
            "date_of_birth": (
                profile.date_of_birth.isoformat()
                if hasattr(profile.date_of_birth, "isoformat")
                else str(profile.date_of_birth)
            ),
            "socmed_platform": profile.socmed_platform,
            "socmed_username": profile.socmed_username,
            **details,
            **{k: v for k, v in raw_responses.items() if not k.startswith("_")},
        }

        pages = wizard_pages or build_default_wizard_pages()
        sections: list[ReviewSectionRead] = []
        for page in pages:
            fields: list[ReviewFieldRead] = []
            for block in page.get("blocks", []):
                b_type = str(block.get("type") or "")
                if b_type not in {t.value for t in INPUT_BLOCK_TYPES}:
                    continue
                field_key = str(block.get("field_key") or "").strip()
                if not field_key or block.get("target") == WizardFieldTarget.UI.value:
                    continue
                if not cls._is_block_applicable(block, is_self, context):
                    continue
                fields.append(
                    ReviewFieldRead(
                        field_key=field_key,
                        label=str(block.get("label") or field_key),
                        type=b_type,
                        value=context.get(field_key),
                    )
                )
            if fields:
                sections.append(
                    ReviewSectionRead(
                        page_id=str(page.get("page_id") or ""),
                        title=str(page.get("title") or ""),
                        fields=fields,
                    )
                )
        return sections

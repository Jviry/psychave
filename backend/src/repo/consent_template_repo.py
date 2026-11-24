from datetime import datetime, timezone
from sqlmodel import Session, select

from models.consent_template import (
    ConsentFormTemplate,
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
from models.forms import Forms
from schemas.consent_template import (
    ConsentFormTemplateUpsert,
    did_consent_blocks_change,
    extract_major_version,
    next_major_version,
    next_minor_version,
)


class ConsentTemplateRepo:
    def __init__(self, db: Session):
        self.db = db

    def get_active(self) -> ConsentFormTemplate | None:
        return self.db.exec(
            select(ConsentFormTemplate)
            .where(ConsentFormTemplate.is_active == True)  # noqa: E712
            .order_by(ConsentFormTemplate.updated_at.desc())
        ).first()

    def get_by_version(self, consent_version: str) -> ConsentFormTemplate | None:
        return self.db.exec(
            select(ConsentFormTemplate).where(
                ConsentFormTemplate.consent_version == consent_version
            )
        ).first()

    def list_all(self) -> list[ConsentFormTemplate]:
        return list(
            self.db.exec(
                select(ConsentFormTemplate).order_by(
                    ConsentFormTemplate.is_active.desc(),
                    ConsentFormTemplate.updated_at.desc(),
                )
            ).all()
        )

    def has_signed_forms(self, consent_version: str) -> bool:
        return (
            self.db.exec(
                select(Forms.form_id).where(
                    Forms.consent_version == consent_version
                )
            ).first()
            is not None
        )

    def ensure_default_seeded(self) -> ConsentFormTemplate:
        active = self.get_active()
        if active is not None:
            if not active.wizard_pages:
                active.wizard_pages = build_default_wizard_pages(
                    informed_consent_text=active.informed_consent_text,
                    typing_statement=active.typing_statement,
                    scope_limitations_text=active.scope_limitations_text,
                    scope_ack_text=active.scope_ack_text,
                    overseas_limitations_text=active.overseas_limitations_text,
                    overseas_ack_text=active.overseas_ack_text,
                    final_consent_statement=active.final_consent_statement,
                )
                self.db.add(active)
                self.db.commit()
                self.db.refresh(active)
            return active

        existing_default = self.get_by_version(DEFAULT_CONSENT_VERSION)
        if existing_default is not None:
            existing_default.is_active = True
            if not existing_default.wizard_pages:
                existing_default.wizard_pages = build_default_wizard_pages()
            existing_default.updated_at = datetime.now(timezone.utc)
            self.db.add(existing_default)
            self.db.commit()
            self.db.refresh(existing_default)
            return existing_default

        now = datetime.now(timezone.utc)
        template = ConsentFormTemplate(
            consent_version=DEFAULT_CONSENT_VERSION,
            informed_consent_text=DEFAULT_INFORMED_CONSENT_TEXT,
            typing_statement=DEFAULT_TYPING_STATEMENT,
            scope_limitations_text=DEFAULT_SCOPE_LIMITATIONS_TEXT,
            scope_ack_text=DEFAULT_SCOPE_ACK_TEXT,
            overseas_limitations_text=DEFAULT_OVERSEAS_LIMITATIONS_TEXT,
            overseas_ack_text=DEFAULT_OVERSEAS_ACK_TEXT,
            final_consent_statement=DEFAULT_FINAL_CONSENT_STATEMENT,
            wizard_pages=build_default_wizard_pages(),
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        self.db.add(template)
        self.db.commit()
        self.db.refresh(template)
        return template

    def upsert_active(self, data: ConsentFormTemplateUpsert) -> ConsentFormTemplate:
        now = datetime.now(timezone.utc)
        current_active = self.ensure_default_seeded()
        all_rows = self.list_all()
        existing_versions = {row.consent_version for row in all_rows}

        serialized_pages = [
            page.model_dump(mode="json") for page in (data.wizard_pages or [])
        ]

        # Determine target consent_version based on bump_type and whether
        # consent blocks changed vs demographic-only changes.
        requested_version = data.consent_version.strip()
        active_version = current_active.consent_version

        if data.bump_type == "major":
            target_version = next_major_version(active_version, existing_versions)
        elif data.bump_type == "minor":
            target_version = next_minor_version(active_version, existing_versions)
        elif data.bump_type == "explicit":
            target_version = requested_version
        else:
            # bump_type == "auto"
            consent_changed = did_consent_blocks_change(
                current_active.wizard_pages or [], serialized_pages
            )
            pages_changed = (current_active.wizard_pages or []) != serialized_pages

            if requested_version != active_version:
                # Caller explicitly specified a different version string (e.g. "v3" or "v2.1")
                target_version = requested_version
            elif consent_changed:
                # Consent blocks or legal text changed -> bump major version if active has signed forms
                # or if the admin edited consent on the active template.
                target_version = next_major_version(
                    active_version, existing_versions
                )
            elif pages_changed:
                # Only demographic/UI blocks changed -> minor decimal bump
                target_version = next_minor_version(
                    active_version, existing_versions
                )
            else:
                target_version = active_version

        # Never overwrite in-place a version that already has signed forms if pages changed
        if (
            target_version in existing_versions
            and self.has_signed_forms(target_version)
            and (current_active.wizard_pages or []) != serialized_pages
        ):
            if did_consent_blocks_change(
                current_active.wizard_pages or [], serialized_pages
            ):
                target_version = next_major_version(
                    target_version, existing_versions
                )
            else:
                target_version = next_minor_version(
                    target_version, existing_versions
                )

        # Deactivate all currently active templates
        for row in self.db.exec(
            select(ConsentFormTemplate).where(
                ConsentFormTemplate.is_active == True  # noqa: E712
            )
        ).all():
            row.is_active = False
            self.db.add(row)

        payload_dict = {
            "consent_version": target_version,
            "informed_consent_text": data.informed_consent_text,
            "typing_statement": data.typing_statement,
            "scope_limitations_text": data.scope_limitations_text,
            "scope_ack_text": data.scope_ack_text,
            "overseas_limitations_text": data.overseas_limitations_text,
            "overseas_ack_text": data.overseas_ack_text,
            "final_consent_statement": data.final_consent_statement,
            "wizard_pages": serialized_pages,
        }

        target = self.get_by_version(target_version)
        if target is not None:
            for field, value in payload_dict.items():
                setattr(target, field, value)
            target.is_active = True
            target.updated_at = now
            self.db.add(target)
            self.db.commit()
            self.db.refresh(target)
            return target

        created = ConsentFormTemplate(
            **payload_dict,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        self.db.add(created)
        self.db.commit()
        self.db.refresh(created)
        return created

from copy import deepcopy
from datetime import datetime, timezone
from typing import Any
import uuid
import sqlalchemy as sa
from sqlmodel import Column, Field, SQLModel

DEFAULT_CONSENT_VERSION = "v2"

DEFAULT_INFORMED_CONSENT_TEXT = """INFORMED CONSENT AND DATA PRIVACY AGREEMENT
This informed consent form explains the nature, purpose, scope, and limitations of the psychological services provided by licensed psychologists of PsychAve PH: Psychological Services, in accordance with the Professional Regulatory Commission (PRC) and the Psychological Association of the Philippines (PAP) Code of Ethics, as well as the Data Privacy Act of 2012 (Republic Act No. 10173).

All information shared during psychological services, including personal data, session content, screening results, and records, is treated as confidential in accordance with PAP ethical standards and Philippine law.

Personal data is collected, processed, and stored solely for legitimate clinical, documentation, and professional purposes. Records are securely maintained and accessed only by the psychologist or authorized personnel.

Confidentiality may be ethically or legally breached only under the following circumstances:

Presence of serious and imminent risk of harm to self or others
Suspected abuse or neglect as required by law
Court orders or lawful demands
Other situations mandated by Philippine laws and professional regulations
Important limitation: All sessions, screening, and results are strictly for therapeutic, clinical, and personal use. These will not be used, shared, or submitted for any legal, court, or administrative proceedings, unless otherwise required by law under exceptional circumstances."""

DEFAULT_TYPING_STATEMENT = (
    "By typing your full name in the designated field, you confirm that you have "
    "read, understood, and voluntarily agreed to the terms stated above. If filling "
    "out for a minor, write your full name and relation to the client."
)

DEFAULT_SCOPE_LIMITATIONS_TEXT = """SCOPE & LIMITATIONS OF SERVICES: All services provided are delivered by licensed psychologists and are intended for clinical, therapeutic, coaching, and personal development purposes only. Services are based on professional training, ethical standards, client self-report, and clinical judgement, and are conducted within the psychologists' scope of competence in accordance with PRC Regulations and PAP ethical guidelines.

Psychological services are not forensic or medico-legal in nature. Information shared, screening results, professional opinions, sessions notes, and documents issued are not intended for court, legal, administrative, or disciplinary proceedings, and no expert testimony or legal opinions will be provided based on these services.

Outcomes may vary among individuals. Recommendations and observations are based on information available at the time of service and may change as new information emerges."""

DEFAULT_SCOPE_ACK_TEXT = (
    "I have read and understood the scope and limitations applicable to all "
    "psychological services provided."
)

DEFAULT_OVERSEAS_LIMITATIONS_TEXT = """LIMITATIONS FOR OVERSEAS CLIENTS AND FOREIGN NATIONALS

(Applicable to clients living abroad and foreign nationals residing in the Philippines)

Jurisdiction and Professional Scope: Psychological services are provided by a psychologist licensed in the Philippines and are governed by Philippine laws, PRC regulations, and the Psychological Association of the Philippines (PAP) Code of Ethics. All services delivered within this professional and legal framework.

Overseas Filipino Clients (Filipino Citizenship): For Filipino clients residing outside the Philippines, services are limited to non-forensic, non-medico-legal psychological support. Services may be subject to legal, regulatory, or practice restrictions in the client's country of residence. The psychologist does not claim licensure or authority to practice psychology under the laws of the host country.

Foreign Nationals: For foreign nationals, whether residing in the Philippines, psychological services are provided for clinical and supportive purposes only and are governed by Philippine professional and ethical standards. Services are not intended to satisfy legal, immigration, employment, or court-related requirements of the client's home country or any other jurisdiction.

Emergency and Crisis Limitations:
Psychological services are not a substitute for local emergency or crisis intervention services. Clients residing outside the Philippines, as well as foreign nationals, are responsible for identifying and accessing appropriate emergency or crisis resources within their current country of residence."""

DEFAULT_OVERSEAS_ACK_TEXT = (
    "I understand the jurisdictional and service limitations applicable to "
    "overseas clients and foreign nationals."
)

DEFAULT_FINAL_CONSENT_STATEMENT = (
    "By typing my full name below, I confirm that I have read and understood the "
    "description, purpose, scope, limitations, confidentiality, data privacy "
    "provisions, and ethical boundaries of the psychological service I am availing."
)


def build_default_wizard_pages(
    informed_consent_text: str = DEFAULT_INFORMED_CONSENT_TEXT,
    typing_statement: str = DEFAULT_TYPING_STATEMENT,
    scope_limitations_text: str = DEFAULT_SCOPE_LIMITATIONS_TEXT,
    scope_ack_text: str = DEFAULT_SCOPE_ACK_TEXT,
    overseas_limitations_text: str = DEFAULT_OVERSEAS_LIMITATIONS_TEXT,
    overseas_ack_text: str = DEFAULT_OVERSEAS_ACK_TEXT,
    final_consent_statement: str = DEFAULT_FINAL_CONSENT_STATEMENT,
) -> list[dict[str, Any]]:
    """Canonical 4-page multi-step wizard specification."""
    return deepcopy(
        [
            {
                "page_id": "step-1-consent",
                "title": "Informed consent & agreement",
                "description": "Review the informed consent and data privacy terms.",
                "blocks": [
                    {
                        "block_id": "informed_consent_doc",
                        "type": "scrollable_doc",
                        "label": "Informed consent text — scroll to read",
                        "content": informed_consent_text,
                        "helper_text": None,
                        "placeholder": None,
                        "target": None,
                        "field_key": None,
                        "applies_to": "all",
                        "required": False,
                        "options": [],
                        "show_if": None,
                        "system_locked": False,
                    },
                    {
                        "block_id": "who_for",
                        "type": "select",
                        "label": "Who is this profile for?",
                        "content": None,
                        "helper_text": None,
                        "placeholder": None,
                        "target": "ui",
                        "field_key": "whoFor",
                        "applies_to": "all",
                        "required": False,
                        "options": [
                            {"value": "myself", "label": "Myself"},
                            {"value": "someone_else", "label": "Someone else"},
                        ],
                        "show_if": None,
                        "system_locked": False,
                    },
                    {
                        "block_id": "relation_to_account_holder",
                        "type": "select",
                        "label": "Relation to account holder",
                        "content": None,
                        "helper_text": None,
                        "placeholder": None,
                        "target": "profile",
                        "field_key": "relation_to_account_holder",
                        "applies_to": "dependent",
                        "required": True,
                        "options": [
                            {"value": "child", "label": "Child"},
                            {"value": "spouse", "label": "Spouse"},
                            {"value": "parent", "label": "Parent"},
                            {"value": "sibling", "label": "Sibling"},
                            {"value": "other", "label": "Other"},
                        ],
                        "show_if": None,
                        "system_locked": True,
                    },
                    {
                        "block_id": "terms_signer_relation",
                        "type": "select",
                        "label": "Signer's relation to the client",
                        "content": None,
                        "helper_text": None,
                        "placeholder": None,
                        "target": "consent",
                        "field_key": "terms_signer_relation",
                        "applies_to": "dependent",
                        "required": True,
                        "options": [
                            {"value": "parent", "label": "Parent"},
                            {"value": "legal guardian", "label": "Legal guardian"},
                            {"value": "spouse", "label": "Spouse"},
                            {"value": "other", "label": "Other"},
                        ],
                        "show_if": None,
                        "system_locked": False,
                    },
                    {
                        "block_id": "terms_signer_name",
                        "type": "text",
                        "label": "Signer full name (typed signature)",
                        "content": None,
                        "helper_text": typing_statement,
                        "placeholder": "Type full name",
                        "target": "consent",
                        "field_key": "terms_signer_name",
                        "applies_to": "all",
                        "required": True,
                        "options": [],
                        "show_if": None,
                        "system_locked": False,
                    },
                ],
            },
            {
                "page_id": "step-2-scope",
                "title": "Services & acknowledgements",
                "description": "Review offered services and clinical scope guardrails.",
                "blocks": [
                    {
                        "block_id": "services_overview",
                        "type": "services_list",
                        "label": "Services offered (read-only)",
                        "content": None,
                        "helper_text": None,
                        "placeholder": None,
                        "target": None,
                        "field_key": None,
                        "applies_to": "all",
                        "required": False,
                        "options": [],
                        "show_if": None,
                        "system_locked": False,
                    },
                    {
                        "block_id": "scope_limitations_doc",
                        "type": "scrollable_doc",
                        "label": "Scope & limitations of services — scroll to read",
                        "content": scope_limitations_text,
                        "helper_text": None,
                        "placeholder": None,
                        "target": None,
                        "field_key": None,
                        "applies_to": "all",
                        "required": False,
                        "options": [],
                        "show_if": None,
                        "system_locked": False,
                    },
                    {
                        "block_id": "scope_acknowledged",
                        "type": "checkbox",
                        "label": scope_ack_text,
                        "content": None,
                        "helper_text": None,
                        "placeholder": None,
                        "target": "consent",
                        "field_key": "scope_acknowledged",
                        "applies_to": "all",
                        "required": True,
                        "options": [],
                        "show_if": None,
                        "system_locked": False,
                    },
                    {
                        "block_id": "is_overseas_or_foreign",
                        "type": "checkbox",
                        "label": "I am an overseas client or foreign national",
                        "content": None,
                        "helper_text": None,
                        "placeholder": None,
                        "target": "consent",
                        "field_key": "is_overseas_or_foreign",
                        "applies_to": "all",
                        "required": False,
                        "options": [],
                        "show_if": None,
                        "system_locked": False,
                    },
                    {
                        "block_id": "overseas_limitations_doc",
                        "type": "scrollable_doc",
                        "label": "Limitations for overseas clients and foreign nationals — scroll to read",
                        "content": overseas_limitations_text,
                        "helper_text": None,
                        "placeholder": None,
                        "target": None,
                        "field_key": None,
                        "applies_to": "all",
                        "required": False,
                        "options": [],
                        "show_if": {
                            "field_key": "is_overseas_or_foreign",
                            "equals": True,
                        },
                        "system_locked": False,
                    },
                    {
                        "block_id": "overseas_acknowledged",
                        "type": "checkbox",
                        "label": overseas_ack_text,
                        "content": None,
                        "helper_text": None,
                        "placeholder": None,
                        "target": "consent",
                        "field_key": "overseas_acknowledged",
                        "applies_to": "all",
                        "required": True,
                        "options": [],
                        "show_if": {
                            "field_key": "is_overseas_or_foreign",
                            "equals": True,
                        },
                        "system_locked": False,
                    },
                ],
            },
            {
                "page_id": "step-3-demographics",
                "title": "Demographics",
                "description": "Provide demographic and contact information.",
                "blocks": [
                    {
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
                    },
                    {
                        "block_id": "date_of_birth",
                        "type": "date",
                        "label": "Date of birth",
                        "content": None,
                        "helper_text": None,
                        "placeholder": None,
                        "target": "persona",
                        "field_key": "date_of_birth",
                        "applies_to": "all",
                        "required": True,
                        "options": [],
                        "show_if": None,
                        "system_locked": True,
                    },
                    {
                        "block_id": "occupation",
                        "type": "text",
                        "label": "Occupation (optional)",
                        "content": None,
                        "helper_text": None,
                        "placeholder": None,
                        "target": "persona",
                        "field_key": "occupation",
                        "applies_to": "all",
                        "required": False,
                        "options": [],
                        "show_if": None,
                        "system_locked": False,
                    },
                    {
                        "block_id": "nationality",
                        "type": "text",
                        "label": "Nationality",
                        "content": None,
                        "helper_text": None,
                        "placeholder": "e.g. Filipino",
                        "target": "persona",
                        "field_key": "nationality",
                        "applies_to": "all",
                        "required": True,
                        "options": [],
                        "show_if": None,
                        "system_locked": False,
                    },
                    {
                        "block_id": "contact_number",
                        "type": "phone",
                        "label": "Contact number",
                        "content": None,
                        "helper_text": None,
                        "placeholder": "09XXXXXXXXX",
                        "target": "persona",
                        "field_key": "contact_number",
                        "applies_to": "all",
                        "required": True,
                        "options": [],
                        "show_if": None,
                        "system_locked": False,
                    },
                    {
                        "block_id": "permanent_address",
                        "type": "textarea",
                        "label": "Permanent address",
                        "content": None,
                        "helper_text": None,
                        "placeholder": None,
                        "target": "persona",
                        "field_key": "permanent_address",
                        "applies_to": "all",
                        "required": True,
                        "options": [],
                        "show_if": None,
                        "system_locked": False,
                    },
                    {
                        "block_id": "present_address",
                        "type": "textarea",
                        "label": "Present address",
                        "content": None,
                        "helper_text": None,
                        "placeholder": None,
                        "target": "persona",
                        "field_key": "present_address",
                        "applies_to": "all",
                        "required": True,
                        "options": [],
                        "show_if": None,
                        "system_locked": False,
                    },
                    {
                        "block_id": "socmed_platform",
                        "type": "select",
                        "label": "Social media platform (optional)",
                        "content": None,
                        "helper_text": None,
                        "placeholder": None,
                        "target": "persona",
                        "field_key": "socmed_platform",
                        "applies_to": "all",
                        "required": False,
                        "options": [
                            {"value": "", "label": "None"},
                            {"value": "instagram", "label": "Instagram"},
                            {"value": "facebook", "label": "Facebook"},
                            {"value": "messenger", "label": "Messenger"},
                            {"value": "tiktok", "label": "TikTok"},
                            {"value": "x", "label": "X"},
                            {"value": "other", "label": "Other"},
                        ],
                        "show_if": None,
                        "system_locked": True,
                    },
                    {
                        "block_id": "socmed_username",
                        "type": "text",
                        "label": "Username (optional)",
                        "content": None,
                        "helper_text": None,
                        "placeholder": "@username",
                        "target": "persona",
                        "field_key": "socmed_username",
                        "applies_to": "all",
                        "required": False,
                        "options": [],
                        "show_if": None,
                        "system_locked": True,
                    },
                    {
                        "block_id": "preferred_contact_mode",
                        "type": "select",
                        "label": "Preferred contact mode",
                        "content": None,
                        "helper_text": None,
                        "placeholder": None,
                        "target": "persona",
                        "field_key": "preferred_contact_mode",
                        "applies_to": "all",
                        "required": True,
                        "options": [
                            {"value": "phone", "label": "Phone"},
                            {"value": "email", "label": "Email"},
                            {"value": "messenger", "label": "Messenger"},
                            {"value": "instagram", "label": "Instagram"},
                        ],
                        "show_if": None,
                        "system_locked": False,
                    },
                    {
                        "block_id": "emergency_contact_heading",
                        "type": "section_heading",
                        "label": "Emergency Contact",
                        "content": None,
                        "helper_text": None,
                        "placeholder": None,
                        "target": None,
                        "field_key": None,
                        "applies_to": "all",
                        "required": False,
                        "options": [],
                        "show_if": None,
                        "system_locked": False,
                    },
                    {
                        "block_id": "emergency_contact_name",
                        "type": "text",
                        "label": "Emergency contact name",
                        "content": None,
                        "helper_text": None,
                        "placeholder": None,
                        "target": "persona",
                        "field_key": "emergency_contact_name",
                        "applies_to": "all",
                        "required": True,
                        "options": [],
                        "show_if": None,
                        "system_locked": False,
                    },
                    {
                        "block_id": "emergency_contact_relation",
                        "type": "text",
                        "label": "Emergency contact relation",
                        "content": None,
                        "helper_text": None,
                        "placeholder": "e.g. Mother",
                        "target": "persona",
                        "field_key": "emergency_contact_relation",
                        "applies_to": "all",
                        "required": True,
                        "options": [],
                        "show_if": None,
                        "system_locked": False,
                    },
                    {
                        "block_id": "emergency_contact_number",
                        "type": "phone",
                        "label": "Emergency contact number",
                        "content": None,
                        "helper_text": None,
                        "placeholder": "09XXXXXXXXX",
                        "target": "persona",
                        "field_key": "emergency_contact_number",
                        "applies_to": "all",
                        "required": True,
                        "options": [],
                        "show_if": None,
                        "system_locked": False,
                    },
                ],
            },
            {
                "page_id": "step-4-confirmation",
                "title": "Confirmation & final consent",
                "description": "Review your entries and sign to complete.",
                "blocks": [
                    {
                        "block_id": "review_summary",
                        "type": "review_summary",
                        "label": "Review your entries before signing",
                        "content": None,
                        "helper_text": None,
                        "placeholder": None,
                        "target": None,
                        "field_key": None,
                        "applies_to": "all",
                        "required": False,
                        "options": [],
                        "show_if": None,
                        "system_locked": False,
                    },
                    {
                        "block_id": "information_confirmed",
                        "type": "checkbox",
                        "label": "I confirm that the information provided is accurate and complete.",
                        "content": None,
                        "helper_text": None,
                        "placeholder": None,
                        "target": "consent",
                        "field_key": "information_confirmed",
                        "applies_to": "all",
                        "required": True,
                        "options": [],
                        "show_if": None,
                        "system_locked": False,
                    },
                    {
                        "block_id": "final_consent_doc",
                        "type": "info_text",
                        "label": "Final consent & acknowledgement",
                        "content": final_consent_statement,
                        "helper_text": None,
                        "placeholder": None,
                        "target": None,
                        "field_key": None,
                        "applies_to": "all",
                        "required": False,
                        "options": [],
                        "show_if": None,
                        "system_locked": False,
                    },
                    {
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
                    },
                ],
            },
        ]
    )


class ConsentFormTemplate(SQLModel, table=True):
    __tablename__: str = "consent_form_templates"
    template_id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    consent_version: str = Field(index=True, unique=True)
    informed_consent_text: str = DEFAULT_INFORMED_CONSENT_TEXT
    typing_statement: str = DEFAULT_TYPING_STATEMENT
    scope_limitations_text: str = DEFAULT_SCOPE_LIMITATIONS_TEXT
    scope_ack_text: str = DEFAULT_SCOPE_ACK_TEXT
    overseas_limitations_text: str = DEFAULT_OVERSEAS_LIMITATIONS_TEXT
    overseas_ack_text: str = DEFAULT_OVERSEAS_ACK_TEXT
    final_consent_statement: str = DEFAULT_FINAL_CONSENT_STATEMENT
    wizard_pages: list[dict[str, Any]] = Field(
        default_factory=build_default_wizard_pages,
        sa_column=Column(sa.JSON(), nullable=False),
    )
    is_active: bool = Field(default=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

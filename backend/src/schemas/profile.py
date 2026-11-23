from datetime import date, datetime
from typing import Any
import uuid
from pydantic import ConfigDict, field_validator, model_validator
from sqlmodel import Field, SQLModel

from models.profile import ContactMode, ProfileRelation

MINOR_CUTOFF_AGE = 18

_CORE_PROFILE_KEYS = {
    "profile_id",
    "relation_to_account_holder",
    "profile_name",
    "date_of_birth",
    "socmed_platform",
    "socmed_username",
    "details",
}

_CORE_CONSENT_KEYS = {
    "consent_version",
    "responses",
    "custom_responses",
    "signed_at",
}


def _calculate_age(dob: date) -> int:
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


class ProfileCreate(SQLModel):
    model_config = ConfigDict(extra="allow")

    relation_to_account_holder: ProfileRelation = ProfileRelation.self_
    profile_name: str
    date_of_birth: date
    socmed_platform: str | None = None
    socmed_username: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)

    # Optional legacy demographic fields (automatically packed into details JSON)
    occupation: str | None = None
    nationality: str | None = None
    permanent_address: str | None = None
    present_address: str | None = None
    contact_number: str | None = None
    preferred_contact_mode: ContactMode | str | None = None
    emergency_contact_name: str | None = None
    emergency_contact_relation: str | None = None
    emergency_contact_number: str | None = None

    @field_validator("date_of_birth")
    @classmethod
    def dob_not_in_future(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("Date of birth cannot be in the future")
        return v

    def merged_details(self) -> dict[str, Any]:
        merged: dict[str, Any] = dict(self.details or {})
        legacy_keys = (
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
        for key in legacy_keys:
            val = getattr(self, key, None)
            if val is not None:
                merged[key] = val.value if isinstance(val, ContactMode) else val

        extra = getattr(self, "__pydantic_extra__", None) or {}
        for key, val in extra.items():
            if key not in _CORE_PROFILE_KEYS and val is not None:
                merged[key] = val
        return merged


class ConsentCreate(SQLModel):
    model_config = ConfigDict(extra="allow")

    consent_version: str
    responses: dict[str, Any] = Field(default_factory=dict)
    custom_responses: dict[str, Any] = Field(default_factory=dict)

    terms_signer_name: str | None = None
    terms_signer_relation: str | None = None
    scope_acknowledged: bool | None = None
    is_overseas_or_foreign: bool | None = None
    overseas_acknowledged: bool | None = None
    information_confirmed: bool | None = None
    consent_signer_name: str | None = None

    def merged_responses(self) -> dict[str, Any]:
        merged: dict[str, Any] = {
            **(self.responses or {}),
            **(self.custom_responses or {}),
        }
        legacy_keys = (
            "terms_signer_name",
            "terms_signer_relation",
            "scope_acknowledged",
            "is_overseas_or_foreign",
            "overseas_acknowledged",
            "information_confirmed",
            "consent_signer_name",
        )
        for key in legacy_keys:
            val = getattr(self, key, None)
            if val is not None:
                merged[key] = val

        extra = getattr(self, "__pydantic_extra__", None) or {}
        for key, val in extra.items():
            if key not in _CORE_CONSENT_KEYS and val is not None:
                merged[key] = val
        return merged


class ProfileWithConsentCreate(SQLModel):
    profile: ProfileCreate
    consent: ConsentCreate


class ProfileRead(SQLModel):
    profile_id: uuid.UUID
    relation_to_account_holder: ProfileRelation
    profile_name: str
    date_of_birth: date
    socmed_platform: str | None = None
    socmed_username: str | None = None
    details: dict[str, Any] = Field(default_factory=dict)

    # Backwards-compatible demographic fields populated from details JSON
    occupation: str | None = None
    nationality: str = ""
    permanent_address: str = ""
    present_address: str = ""
    contact_number: str = ""
    preferred_contact_mode: str = "phone"
    emergency_contact_name: str = ""
    emergency_contact_relation: str = ""
    emergency_contact_number: str = ""

    # Consent status metadata
    signed_consent_version: str | None = None
    active_consent_version: str = "v2"
    consent_outdated: bool = False

    @classmethod
    def from_model(
        cls,
        profile: Any,
        signed_consent_version: str | None = None,
        active_consent_version: str = "v2",
        consent_outdated: bool = False,
    ) -> "ProfileRead":
        details = dict(getattr(profile, "details", None) or {})
        pref = details.get("preferred_contact_mode") or "phone"
        if hasattr(pref, "value"):
            pref = pref.value
        return cls(
            profile_id=profile.profile_id,
            relation_to_account_holder=profile.relation_to_account_holder,
            profile_name=profile.profile_name,
            date_of_birth=profile.date_of_birth,
            socmed_platform=profile.socmed_platform,
            socmed_username=profile.socmed_username,
            details=details,
            occupation=details.get("occupation"),
            nationality=str(details.get("nationality") or ""),
            permanent_address=str(details.get("permanent_address") or ""),
            present_address=str(details.get("present_address") or ""),
            contact_number=str(details.get("contact_number") or ""),
            preferred_contact_mode=str(pref),
            emergency_contact_name=str(
                details.get("emergency_contact_name") or ""
            ),
            emergency_contact_relation=str(
                details.get("emergency_contact_relation") or ""
            ),
            emergency_contact_number=str(
                details.get("emergency_contact_number") or ""
            ),
            signed_consent_version=signed_consent_version,
            active_consent_version=active_consent_version,
            consent_outdated=consent_outdated,
        )


class ConsentRead(SQLModel):
    consent_version: str
    responses: dict[str, Any] = Field(default_factory=dict)

    # Backwards-compatible consent fields populated from responses JSON
    terms_signer_name: str = ""
    terms_signer_relation: str = "self"
    scope_acknowledged: bool = False
    is_overseas_or_foreign: bool = False
    overseas_acknowledged: bool = False
    information_confirmed: bool = False
    consent_signer_name: str = ""
    signed_at: datetime | None = None

    @classmethod
    def from_model(cls, form: Any) -> "ConsentRead":
        raw_responses = dict(getattr(form, "responses", None) or {})
        clean_responses = {
            k: v for k, v in raw_responses.items() if not k.startswith("_")
        }
        return cls(
            consent_version=form.consent_version,
            responses=clean_responses,
            terms_signer_name=str(clean_responses.get("terms_signer_name") or ""),
            terms_signer_relation=str(
                clean_responses.get("terms_signer_relation") or "self"
            ),
            scope_acknowledged=bool(
                clean_responses.get("scope_acknowledged", False)
            ),
            is_overseas_or_foreign=bool(
                clean_responses.get("is_overseas_or_foreign", False)
            ),
            overseas_acknowledged=bool(
                clean_responses.get("overseas_acknowledged", False)
            ),
            information_confirmed=bool(
                clean_responses.get("information_confirmed", False)
            ),
            consent_signer_name=str(
                clean_responses.get("consent_signer_name") or ""
            ),
            signed_at=getattr(form, "signed_at", None),
        )


class ReviewFieldRead(SQLModel):
    field_key: str
    label: str
    type: str
    value: Any


class ReviewSectionRead(SQLModel):
    page_id: str
    title: str
    fields: list[ReviewFieldRead]


class ProfileReviewResponse(SQLModel):
    profile: ProfileRead
    consent: ConsentRead
    review_sections: list[ReviewSectionRead] = Field(default_factory=list)

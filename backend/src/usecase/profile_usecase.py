import uuid
from sqlmodel import Session

from common.exceptions import ConflictError, NotFoundError, ValidationError
from models.profile import ProfileRelation
from repo.profile_repo import ProfileRepo
from schemas.profile import (
    ProfileCreate,
    ProfileWithConsentCreate,
    ConsentRead,
    ProfileRead,
    MINOR_CUTOFF_AGE,
    _calculate_age,
)

CURRENT_CONSENT_VERSION = "v2"


class ProfileUsecase:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ProfileRepo(db)

    def create_profile(self, payload: ProfileWithConsentCreate, client_id: uuid.UUID):
        if payload.profile.relation_to_account_holder == ProfileRelation.self_:
            raise ValidationError(
                "Cannot create a 'self' profile — your personal profile is created during account registration"
            )

        consent_data = payload.consent

        if consent_data.consent_version != CURRENT_CONSENT_VERSION:
            raise ConflictError(
                f"Consent form is outdated — current version is {CURRENT_CONSENT_VERSION}",
            )

        return self.repo.create_with_consent(client_id, payload.profile, consent_data)

    def list_profiles(self, client_id: uuid.UUID):
        return self.repo.get_for_client(client_id)

    def get_profile(self, profile_id: uuid.UUID, client_id: uuid.UUID):
        profile = self.repo.get_by_id(profile_id)
        if profile is None or profile.client_id != client_id:
            raise NotFoundError("Profile not found")
        return profile

    def delete_profile(self, profile_id: uuid.UUID, client_id: uuid.UUID) -> ProfileRead:
        profile = self.repo.get_by_id(profile_id)
        if profile is None or profile.client_id != client_id:
            raise NotFoundError("Profile not found")
        if profile.relation_to_account_holder == ProfileRelation.self_:
            raise ConflictError("Cannot delete your primary self-profile")
        if self.repo.has_active_appointments(profile_id):
            raise ConflictError(
                "Cannot delete profile with active appointments")
        # Snapshot before delete — the session expires attributes on commit.
        deleted = ProfileRead.model_validate(profile)
        self.repo.delete_profile(profile_id)
        return deleted

    def update_profile(
        self, profile_id: uuid.UUID, data: ProfileCreate, client_id: uuid.UUID
    ):
        profile = self.repo.get_by_id(profile_id)
        if profile is None or profile.client_id != client_id:
            raise NotFoundError("Profile not found")

        if (
            profile.relation_to_account_holder == ProfileRelation.self_
            and data.relation_to_account_holder != ProfileRelation.self_
        ):
            raise ValidationError("Cannot change the relation of your primary self-profile")

        if (
            profile.relation_to_account_holder != ProfileRelation.self_
            and data.relation_to_account_holder == ProfileRelation.self_
        ):
            raise ValidationError("Cannot change a dependent profile relation to 'self'")

        if (
            profile.relation_to_account_holder == ProfileRelation.self_
            and _calculate_age(data.date_of_birth) < MINOR_CUTOFF_AGE
        ):
            raise ValidationError("Primary account holder must be at least 18 years old")

        form = self.repo.get_latest_form(profile_id)
        if (
            form is not None
            and _calculate_age(data.date_of_birth) < MINOR_CUTOFF_AGE
            and form.terms_signer_relation == "self"
        ):
            raise ValidationError(
                "A minor's consent cannot be signed as 'self' — provide the signer's relation"
            )

        return self.repo.update_profile(profile, data)

    def get_profile_for_psychologist(self, profile_id: uuid.UUID):
        profile = self.repo.get_by_id(profile_id)
        if profile is None:
            raise NotFoundError("Profile not found")

        form = self.repo.get_latest_form(profile_id)
        if form is None:
            raise NotFoundError("Consent form not found")

        return {
            "profile": ProfileRead.model_validate(profile),
            "consent": ConsentRead.model_validate(form)
        }

import uuid
from sqlmodel import Session

from common.exceptions import (
    ConflictError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
)
from models.profile import Profile, ProfileRelation
from repo.consent_template_repo import ConsentTemplateRepo
from repo.profile_repo import ProfileRepo
from schemas.consent_template import extract_major_version
from schemas.profile import (
    ConsentCreate,
    ConsentRead,
    MINOR_CUTOFF_AGE,
    ProfileCreate,
    ProfileRead,
    ProfileWithConsentCreate,
    _calculate_age,
)
from usecase.consent_template_usecase import ConsentTemplateUsecase


class ProfileUsecase:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ProfileRepo(db)
        self.consent_template_repo = ConsentTemplateRepo(db)

    def _get_active_template(self):
        return self.consent_template_repo.ensure_default_seeded()

    def _to_profile_read(self, profile: Profile) -> ProfileRead:
        active_template = self._get_active_template()
        active_version = active_template.consent_version
        latest_form = self.repo.get_latest_form(profile.profile_id)
        signed_version = (
            latest_form.consent_version if latest_form is not None else None
        )
        consent_outdated = (
            signed_version is not None
            and extract_major_version(signed_version)
            != extract_major_version(active_version)
        )
        return ProfileRead.from_model(
            profile,
            signed_consent_version=signed_version,
            active_consent_version=active_version,
            consent_outdated=consent_outdated,
        )

    def create_profile(
        self, payload: ProfileWithConsentCreate, client_id: uuid.UUID
    ) -> ProfileRead:
        if payload.profile.relation_to_account_holder == ProfileRelation.self_:
            raise ValidationError(
                "Cannot create a 'self' profile — your personal profile is created during account registration"
            )

        active_template = self._get_active_template()
        details, responses, _sections = (
            ConsentTemplateUsecase.validate_wizard_submission(
                wizard_pages=active_template.wizard_pages,
                active_version=active_template.consent_version,
                profile_data=payload.profile,
                consent_data=payload.consent,
                validate_demographics=True,
                validate_consent=True,
            )
        )
        profile = self.repo.create_with_consent(
            client_id=client_id,
            profile_data=payload.profile,
            consent_version=active_template.consent_version,
            details=details,
            responses=responses,
        )
        return self._to_profile_read(profile)

    def resign_consent(
        self,
        profile_id: uuid.UUID,
        payload: ConsentCreate,
        client_id: uuid.UUID,
    ) -> ProfileRead:
        profile = self.repo.get_by_id(profile_id)
        if profile is None or profile.client_id != client_id:
            raise NotFoundError("Profile not found")

        active_template = self._get_active_template()
        profile_snapshot = ProfileCreate(
            relation_to_account_holder=profile.relation_to_account_holder,
            profile_name=profile.profile_name,
            date_of_birth=profile.date_of_birth,
            socmed_platform=profile.socmed_platform,
            socmed_username=profile.socmed_username,
            details=dict(profile.details or {}),
        )
        _details, responses, _sections = (
            ConsentTemplateUsecase.validate_wizard_submission(
                wizard_pages=active_template.wizard_pages,
                active_version=active_template.consent_version,
                profile_data=profile_snapshot,
                consent_data=payload,
                validate_demographics=False,
                validate_consent=True,
            )
        )
        self.repo.create_consent_form(
            profile_id=profile.profile_id,
            consent_version=active_template.consent_version,
            responses=responses,
        )
        return self._to_profile_read(profile)

    def list_profiles(self, client_id: uuid.UUID) -> list[ProfileRead]:
        profiles = self.repo.get_for_client(client_id)
        return [self._to_profile_read(p) for p in profiles]

    def get_profile(
        self, profile_id: uuid.UUID, client_id: uuid.UUID
    ) -> ProfileRead:
        profile = self.repo.get_by_id(profile_id)
        if profile is None or profile.client_id != client_id:
            raise NotFoundError("Profile not found")
        return self._to_profile_read(profile)

    def delete_profile(
        self, profile_id: uuid.UUID, client_id: uuid.UUID
    ) -> ProfileRead:
        profile = self.repo.get_by_id(profile_id)
        if profile is None or profile.client_id != client_id:
            raise NotFoundError("Profile not found")
        if profile.relation_to_account_holder == ProfileRelation.self_:
            raise ConflictError("Cannot delete your primary self-profile")
        if self.repo.has_active_appointments(profile_id):
            raise ConflictError(
                "Cannot delete profile with active appointments"
            )
        deleted = self._to_profile_read(profile)
        self.repo.delete_profile(profile_id)
        return deleted

    def update_profile(
        self, profile_id: uuid.UUID, data: ProfileCreate, client_id: uuid.UUID
    ) -> ProfileRead:
        profile = self.repo.get_by_id(profile_id)
        if profile is None or profile.client_id != client_id:
            raise NotFoundError("Profile not found")

        if (
            profile.relation_to_account_holder == ProfileRelation.self_
            and data.relation_to_account_holder != ProfileRelation.self_
        ):
            raise ValidationError(
                "Cannot change the relation of your primary self-profile"
            )

        if (
            profile.relation_to_account_holder != ProfileRelation.self_
            and data.relation_to_account_holder == ProfileRelation.self_
        ):
            raise ValidationError(
                "Cannot change a dependent profile relation to 'self'"
            )

        if (
            profile.relation_to_account_holder == ProfileRelation.self_
            and _calculate_age(data.date_of_birth) < MINOR_CUTOFF_AGE
        ):
            raise ValidationError(
                "Primary account holder must be at least 18 years old"
            )

        form = self.repo.get_latest_form(profile_id)
        if (
            form is not None
            and _calculate_age(data.date_of_birth) < MINOR_CUTOFF_AGE
            and form.terms_signer_relation == "self"
        ):
            raise ValidationError(
                "A minor's consent cannot be signed as 'self' — provide the signer's relation"
            )

        existing_details = dict(profile.details or {})
        incoming_details = {**existing_details, **data.merged_details()}
        merged_input = ProfileCreate(
            relation_to_account_holder=data.relation_to_account_holder,
            profile_name=data.profile_name,
            date_of_birth=data.date_of_birth,
            socmed_platform=(
                data.socmed_platform
                if data.socmed_platform is not None
                else profile.socmed_platform
            ),
            socmed_username=(
                data.socmed_username
                if data.socmed_username is not None
                else profile.socmed_username
            ),
            details=incoming_details,
        )

        active_template = self._get_active_template()
        validated_details, _responses, _sections = (
            ConsentTemplateUsecase.validate_wizard_submission(
                wizard_pages=active_template.wizard_pages,
                active_version=active_template.consent_version,
                profile_data=merged_input,
                consent_data=None,
                validate_demographics=True,
                validate_consent=False,
            )
        )

        updated = self.repo.update_profile(
            profile, merged_input, validated_details
        )
        return self._to_profile_read(updated)

    def get_profile_for_psychologist(
        self, profile_id: uuid.UUID, psychologist_id: uuid.UUID | None = None
    ):
        if psychologist_id is None or not self.repo.is_accessible_to_psychologist(
            profile_id, psychologist_id
        ):
            raise ForbiddenError("You do not have access to review this profile")

        profile = self.repo.get_by_id(profile_id)
        if profile is None:
            raise NotFoundError("Profile not found")

        form = self.repo.get_latest_form(profile_id)
        if form is None:
            raise NotFoundError("Consent form not found")

        signed_template = self.consent_template_repo.get_by_version(
            form.consent_version
        ) or self._get_active_template()
        review_sections = ConsentTemplateUsecase.build_review_sections(
            signed_template.wizard_pages, profile, form
        )

        return {
            "profile": self._to_profile_read(profile),
            "consent": ConsentRead.from_model(form),
            "review_sections": review_sections,
        }

from typing import Any
import uuid
from sqlmodel import Session, or_, select
from models.profile import Profile, ProfileRelation
from models.forms import Forms
from models.appointment import Appointment, AppointmentStatus
from models.proposed_slot import ProposedSlot
from schemas.profile import ProfileCreate

# Appointments in these statuses keep their profile alive — delete is blocked.
# CONFIRMED + COMPLETED included: paid history must survive for records.
ACTIVE_APPOINTMENT_STATUSES = (
    AppointmentStatus.PENDING,
    AppointmentStatus.AWAITING_SCHEDULE,
    AppointmentStatus.AWAITING_PAYMENT,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.COMPLETED,
)


class ProfileRepo:
    def __init__(self, db: Session):
        self.db = db

    def create_with_consent(
        self,
        client_id: uuid.UUID,
        profile_data: ProfileCreate,
        consent_version: str,
        details: dict[str, Any],
        responses: dict[str, Any],
    ) -> Profile:
        profile = Profile(
            client_id=client_id,
            relation_to_account_holder=profile_data.relation_to_account_holder,
            profile_name=profile_data.profile_name.strip(),
            date_of_birth=profile_data.date_of_birth,
            socmed_platform=profile_data.socmed_platform,
            socmed_username=profile_data.socmed_username,
            details=details,
        )
        self.db.add(profile)
        self.db.flush()

        form = Forms(
            profile_id=profile.profile_id,
            consent_version=consent_version,
            responses=responses,
        )
        self.db.add(form)

        self.db.commit()
        self.db.refresh(profile)
        return profile

    def create_consent_form(
        self,
        profile_id: uuid.UUID,
        consent_version: str,
        responses: dict[str, Any],
    ) -> Forms:
        form = Forms(
            profile_id=profile_id,
            consent_version=consent_version,
            responses=responses,
        )
        self.db.add(form)
        self.db.commit()
        self.db.refresh(form)
        return form

    def get_for_client(self, client_id: uuid.UUID) -> list[Profile]:
        return list(
            self.db.exec(
                select(Profile).where(Profile.client_id == client_id)
            ).all()
        )

    def get_self_profile(self, client_id: uuid.UUID) -> Profile | None:
        return self.db.exec(
            select(Profile).where(
                Profile.client_id == client_id,
                Profile.relation_to_account_holder == ProfileRelation.self_,
            )
        ).first()

    def get_by_id(self, profile_id: uuid.UUID) -> Profile | None:
        return self.db.get(Profile, profile_id)

    def update_profile(
        self,
        profile: Profile,
        data: ProfileCreate,
        merged_details: dict[str, Any],
    ) -> Profile:
        profile.relation_to_account_holder = data.relation_to_account_holder
        profile.profile_name = data.profile_name.strip()
        profile.date_of_birth = data.date_of_birth
        profile.socmed_platform = data.socmed_platform
        profile.socmed_username = data.socmed_username
        profile.details = merged_details
        self.db.add(profile)
        self.db.commit()
        self.db.refresh(profile)
        return profile

    def get_latest_form(self, profile_id: uuid.UUID) -> Forms | None:
        return self.db.exec(
            select(Forms)
            .where(Forms.profile_id == profile_id)
            .order_by(Forms.signed_at.desc())
        ).first()

    def has_active_appointments(self, profile_id: uuid.UUID) -> bool:
        return (
            self.db.exec(
                select(Appointment.appointment_id).where(
                    Appointment.profile_id == profile_id,
                    Appointment.status.in_(ACTIVE_APPOINTMENT_STATUSES),
                )
            ).first()
            is not None
        )

    def is_accessible_to_psychologist(
        self, profile_id: uuid.UUID, psychologist_id: uuid.UUID
    ) -> bool:
        """Allow review if the profile has an open PENDING request or an appointment with this psychologist."""
        return (
            self.db.exec(
                select(Appointment.appointment_id).where(
                    Appointment.profile_id == profile_id,
                    or_(
                        Appointment.status == AppointmentStatus.PENDING,
                        Appointment.psychologist_id == psychologist_id,
                    ),
                )
            ).first()
            is not None
        )

    def delete_profile(self, profile_id: uuid.UUID) -> None:
        """Delete a profile plus its forms and inactive appointment history."""
        appointment_ids = self.db.exec(
            select(Appointment.appointment_id).where(
                Appointment.profile_id == profile_id
            )
        ).all()
        for slot in self.db.exec(
            select(ProposedSlot).where(
                ProposedSlot.appointment_id.in_(appointment_ids)
            )
        ).all():
            self.db.delete(slot)
        for appt in self.db.exec(
            select(Appointment).where(Appointment.profile_id == profile_id)
        ).all():
            self.db.delete(appt)
        for form in self.db.exec(
            select(Forms).where(Forms.profile_id == profile_id)
        ).all():
            self.db.delete(form)
        profile = self.db.get(Profile, profile_id)
        if profile is not None:
            self.db.delete(profile)
        self.db.commit()

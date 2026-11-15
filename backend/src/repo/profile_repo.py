import uuid
from sqlmodel import Session, select
from models.profile import Profile, ProfileRelation
from models.forms import Forms
from models.appointment import Appointment, AppointmentStatus
from models.proposed_slot import ProposedSlot
from schemas.profile import ProfileCreate, ConsentCreate

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
        self, client_id: uuid.UUID, profile_data: ProfileCreate, consent_data: ConsentCreate
    ) -> Profile:
        profile = Profile(client_id=client_id, **profile_data.model_dump())
        self.db.add(profile)
        self.db.flush()

        form = Forms(profile_id=profile.profile_id,
                     **consent_data.model_dump())
        self.db.add(form)

        self.db.commit()
        self.db.refresh(profile)
        return profile

    def get_for_client(self, client_id: uuid.UUID) -> list[Profile]:
        return self.db.exec(select(Profile).where(Profile.client_id == client_id)).all()

    def get_self_profile(self, client_id: uuid.UUID) -> Profile | None:
        return self.db.exec(
            select(Profile).where(
                Profile.client_id == client_id,
                Profile.relation_to_account_holder == ProfileRelation.self_,
            )
        ).first()

    def get_by_id(self, profile_id: uuid.UUID) -> Profile | None:
        return self.db.get(Profile, profile_id)

    def update_profile(self, profile: Profile, data: ProfileCreate) -> Profile:
        for field, value in data.model_dump().items():
            setattr(profile, field, value)
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
        return self.db.exec(
            select(Appointment.appointment_id)
            .where(
                Appointment.profile_id == profile_id,
                Appointment.status.in_(ACTIVE_APPOINTMENT_STATUSES),
            )
        ).first() is not None

    def delete_profile(self, profile_id: uuid.UUID) -> None:
        """Delete a profile plus its forms and inactive appointment history.

        Cancelled appointments and their proposed slots are removed too,
        otherwise their non-nullable profile_id FK would be violated.
        Callers must block on has_active_appointments() first.
        """
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

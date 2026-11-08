import uuid

from sqlalchemy import func, or_
from sqlmodel import Session, select

from models.admin_profile import AdminProfile
from models.client_profile import ClientProfile
from models.psychologist_profile import PsychologistProfile
from models.user import User, UserRole


class UserRepository:

    def __init__(self, session: Session):
        self.session = session

    def get_by_id(self, user_id: uuid.UUID) -> User | None:
        return self.session.get(User, user_id)

    def get_by_cognito_sub(self, cognito_sub: str) -> User | None:
        return self.session.exec(
            select(User).where(User.cognito_sub == cognito_sub)
        ).first()

    def get_by_sub(self, sub: str) -> User | None:
        return self.get_by_cognito_sub(sub)

    def list_users(
        self,
        role: UserRole | None,
        search: str | None,
        page: int,
        page_size: int,
    ) -> tuple[list[User], int]:
        """Return one page of users plus the total matching the same filters.

        Search covers the account email and the name-bearing profile rows so
        admins can find a user by either. Both profile joins are one-to-one on
        ``user_id``, so they never duplicate rows.
        """
        conditions = self._filters(role, search)

        statement = (
            self._joined_users()
            .where(*conditions)
            .order_by(User.created_at.desc(), User.user_id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        users = list(self.session.exec(statement).all())

        count_statement = (
            select(func.count(User.user_id))
            .select_from(User)
            .outerjoin(
                PsychologistProfile,
                PsychologistProfile.psychologist_id == User.user_id,
            )
            .outerjoin(AdminProfile, AdminProfile.admin_id == User.user_id)
            .where(*conditions)
        )
        total = self.session.exec(count_statement).one()

        return users, total

    def count_by_role(self, role: UserRole) -> int:
        return self.session.exec(
            select(func.count(User.user_id)).where(User.role == role.value)
        ).one()

    def create(self, user: User) -> User:
        self.session.add(user)
        self.session.commit()
        self.session.refresh(user)
        return user

    def update(self, user: User) -> User:
        self.session.add(user)
        self.session.commit()
        self.session.refresh(user)
        return user

    def get_psychologist_profile(
        self, user_id: uuid.UUID
    ) -> PsychologistProfile | None:
        return self.session.get(PsychologistProfile, user_id)

    def get_admin_profile(self, user_id: uuid.UUID) -> AdminProfile | None:
        return self.session.get(AdminProfile, user_id)

    def ensure_role_profile(self, user: User, display_name: str) -> None:
        """Create the role's profile row when missing (idempotent)."""
        name = display_name or user.email

        if user.role == UserRole.CLIENT.value:
            if self.session.get(ClientProfile, user.user_id) is None:
                self.session.add(ClientProfile(client_id=user.user_id))
        elif user.role == UserRole.PSYCHOLOGIST.value:
            if self.session.get(PsychologistProfile, user.user_id) is None:
                self.session.add(
                    PsychologistProfile(
                        psychologist_id=user.user_id,
                        full_name=name,
                    )
                )
        elif user.role == UserRole.ADMIN.value:
            if self.session.get(AdminProfile, user.user_id) is None:
                self.session.add(
                    AdminProfile(admin_id=user.user_id, full_name=name)
                )

        self.session.commit()

    def apply_role_change(
        self,
        user: User,
        target_role: UserRole,
        full_name: str | None,
        profile_fields: dict,
    ) -> User:
        """Upsert the target role's profile row and update the cached role.

        Existing profile rows are intentionally kept on demotion: personas and
        appointments reference them, and they preserve historical data.
        Rolls back on error so callers can undo upstream Cognito group changes.
        """
        try:
            if target_role == UserRole.CLIENT:
                if self.session.get(ClientProfile, user.user_id) is None:
                    self.session.add(ClientProfile(client_id=user.user_id))

            elif target_role == UserRole.PSYCHOLOGIST:
                profile = self.session.get(PsychologistProfile, user.user_id)
                if profile is None:
                    profile = PsychologistProfile(
                        psychologist_id=user.user_id,
                        full_name=full_name or user.email,
                    )
                    self.session.add(profile)
                elif full_name:
                    profile.full_name = full_name

                for field, value in profile_fields.items():
                    setattr(profile, field, value)
                self.session.add(profile)

            elif target_role == UserRole.ADMIN:
                profile = self.session.get(AdminProfile, user.user_id)
                if profile is None:
                    self.session.add(
                        AdminProfile(
                            admin_id=user.user_id,
                            full_name=full_name or user.email,
                        )
                    )
                elif full_name:
                    profile.full_name = full_name
                    self.session.add(profile)

            user.role = target_role.value
            self.session.add(user)
            self.session.commit()
        except Exception:
            self.session.rollback()
            raise

        self.session.refresh(user)
        return user

    def _joined_users(self):
        return (
            select(User)
            .outerjoin(
                PsychologistProfile,
                PsychologistProfile.psychologist_id == User.user_id,
            )
            .outerjoin(AdminProfile, AdminProfile.admin_id == User.user_id)
        )

    def _filters(self, role: UserRole | None, search: str | None) -> list:
        conditions = []

        if role is not None:
            conditions.append(User.role == role.value)

        search = (search or "").strip()
        if search:
            pattern = f"%{search}%"
            conditions.append(
                or_(
                    User.email.ilike(pattern),
                    PsychologistProfile.full_name.ilike(pattern),
                    AdminProfile.full_name.ilike(pattern),
                )
            )

        return conditions

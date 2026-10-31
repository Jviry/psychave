import logging
import uuid

from sqlmodel import Session

from common.exceptions import ConflictError, NotFoundError, ValidationError
from models.admin_profile import AdminProfile
from models.client_profile import ClientProfile
from models.psychologist_profile import PsychologistProfile
from models.user import User, UserRole
from repo.user_repo import UserRepository
from schemas.admin import AdminUserPage, AdminUserRead, PromotePsychologistRequest
from services.aws.cognito_service import CognitoService

logger = logging.getLogger("uvicorn.error")


class AdminUsecase:

    def __init__(self, service: CognitoService, db: Session):
        self.auth = service
        self.db = db
        self.user_repo = UserRepository(db)

    def list_users(
        self,
        role: UserRole | None,
        search: str | None,
        page: int,
        page_size: int,
    ) -> AdminUserPage:
        users, total = self.user_repo.list_users(role, search, page, page_size)

        return AdminUserPage(
            items=[self._read_user(user) for user in users],
            total=total,
            page=page,
            page_size=page_size,
        )

    def change_role(
        self,
        user_id: uuid.UUID,
        target_role: UserRole,
        full_name: str | None,
        acting_admin_id: uuid.UUID,
    ) -> AdminUserRead:
        user = self.user_repo.get_by_id(user_id)

        if user is None:
            raise NotFoundError("User not found")

        # Changing your own role would strip the acting admin's own access on
        # the next sign-in, so it is always rejected.
        if user.user_id == acting_admin_id:
            raise ConflictError("You cannot change your own role")

        current_role = UserRole(user.role)
        if current_role == target_role:
            return self._read_user(user)

        if (
            current_role == UserRole.ADMIN
            and self.user_repo.count_by_role(UserRole.ADMIN) <= 1
        ):
            raise ConflictError("Cannot change the role of the last admin account")

        resolved_name = self._resolve_full_name(user, target_role, full_name)
        return self._change_role(user, target_role, resolved_name)

    def promote_to_psychologist(
        self, user_id: uuid.UUID, payload: PromotePsychologistRequest
    ) -> AdminUserRead:
        user = self.user_repo.get_by_id(user_id)

        if user is None:
            raise NotFoundError("User not found")
        if user.role == UserRole.PSYCHOLOGIST.value:
            raise ConflictError("User is already a psychologist")
        if user.role == UserRole.ADMIN.value:
            raise ConflictError("Admin accounts cannot be promoted to psychologist")
        if user.role != UserRole.CLIENT.value:
            raise ConflictError("Only client accounts can be promoted to psychologist")

        data = payload.model_dump(exclude_unset=True)
        data.pop("full_name", None)
        if "social_media_links" in data:
            data["social_media_links"] = [
                link.model_dump() for link in payload.social_media_links
            ]

        return self._change_role(
            user,
            UserRole.PSYCHOLOGIST,
            payload.full_name,
            profile_fields=data,
        )

    def _change_role(
        self,
        user: User,
        target_role: UserRole,
        full_name: str | None,
        profile_fields: dict | None = None,
    ) -> AdminUserRead:
        username = self.auth.get_username_by_email(user.email)
        if username is None:
            raise NotFoundError("Cognito account not found for this user")

        previous_groups = set(self.auth.list_user_groups(username))
        self.auth.set_role_group(username, target_role.value)

        try:
            self._apply_role(
                user, target_role, full_name, profile_fields or {})
            self.db.commit()
        except Exception:
            self.db.rollback()
            try:
                self.auth.set_user_groups(username, previous_groups)
            except Exception:
                logger.exception(
                    "Failed to restore Cognito groups for %s after a failed "
                    "role change", username,
                )
            raise

        self.db.refresh(user)
        return self._read_user(user)

    def _resolve_full_name(
        self,
        user: User,
        target_role: UserRole,
        full_name: str | None,
    ) -> str | None:
        """Pick the display name for the target role's profile row.

        Psychologists need a real name because clients see it after booking;
        admins fall back to the account email. Clients have no name column.
        """
        name = (full_name or "").strip() or None
        if name:
            return name

        if target_role == UserRole.PSYCHOLOGIST:
            profile = self.db.get(PsychologistProfile, user.user_id)
            if profile is not None and profile.full_name.strip():
                return profile.full_name
            raise ValidationError(
                "Full name is required when assigning the psychologist role"
            )

        if target_role == UserRole.ADMIN:
            profile = self.db.get(AdminProfile, user.user_id)
            if profile is not None and profile.full_name.strip():
                return profile.full_name
            return user.email

        return None

    def _apply_role(
        self,
        user: User,
        target_role: UserRole,
        full_name: str | None,
        profile_fields: dict,
    ) -> None:
        """Upsert the target role's profile row and update the cached role.

        Existing profile rows are intentionally kept on demotion: personas and
        appointments reference them, and they preserve historical data.
        """
        if target_role == UserRole.CLIENT:
            if self.db.get(ClientProfile, user.user_id) is None:
                self.db.add(ClientProfile(client_id=user.user_id))

        elif target_role == UserRole.PSYCHOLOGIST:
            profile = self.db.get(PsychologistProfile, user.user_id)
            if profile is None:
                profile = PsychologistProfile(
                    psychologist_id=user.user_id,
                    full_name=full_name or user.email,
                )
                self.db.add(profile)
            elif full_name:
                profile.full_name = full_name

            for field, value in profile_fields.items():
                setattr(profile, field, value)
            self.db.add(profile)

        elif target_role == UserRole.ADMIN:
            profile = self.db.get(AdminProfile, user.user_id)
            if profile is None:
                self.db.add(
                    AdminProfile(
                        admin_id=user.user_id,
                        full_name=full_name or user.email,
                    )
                )
            elif full_name:
                profile.full_name = full_name
                self.db.add(profile)

        user.role = target_role.value
        self.db.add(user)

    def _read_user(self, user: User) -> AdminUserRead:
        psych_profile = self.db.get(PsychologistProfile, user.user_id)
        admin_profile = self.db.get(AdminProfile, user.user_id)

        full_name = None
        if user.role == UserRole.ADMIN.value and admin_profile is not None:
            full_name = admin_profile.full_name
        elif user.role == UserRole.PSYCHOLOGIST.value and psych_profile is not None:
            full_name = psych_profile.full_name
        elif psych_profile is not None:
            full_name = psych_profile.full_name
        elif admin_profile is not None:
            full_name = admin_profile.full_name

        return AdminUserRead(
            user_id=user.user_id,
            email=user.email,
            role=UserRole(user.role),
            full_name=full_name,
            created_at=user.created_at,
        )

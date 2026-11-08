import logging
import uuid

from sqlmodel import Session

from common.exceptions import ConflictError, NotFoundError, ValidationError
from interfaces.auth import AuthService
from models.user import User, UserRole
from repo.user_repo import UserRepository
from schemas.admin import AdminUserPage, AdminUserRead, PromotePsychologistRequest

logger = logging.getLogger("uvicorn.error")


class AdminUsecase:

    def __init__(self, service: AuthService, db: Session):
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
        username = self.auth.get_username_by_sub(
            user.cognito_sub
        ) or self.auth.get_username_by_email(user.email)
        if username is None:
            raise NotFoundError("Cognito account not found for this user")

        previous_groups = set(self.auth.list_user_groups(username))
        self.auth.set_role_group(username, target_role.value)

        try:
            user = self.user_repo.apply_role_change(
                user, target_role, full_name, profile_fields or {}
            )
        except Exception:
            try:
                self.auth.set_user_groups(username, previous_groups)
            except Exception:
                logger.exception(
                    "Failed to restore Cognito groups for %s after a failed "
                    "role change", username,
                )
            raise

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
            profile = self.user_repo.get_psychologist_profile(user.user_id)
            if profile is not None and profile.full_name.strip():
                return profile.full_name
            raise ValidationError(
                "Full name is required when assigning the psychologist role"
            )

        if target_role == UserRole.ADMIN:
            profile = self.user_repo.get_admin_profile(user.user_id)
            if profile is not None and profile.full_name.strip():
                return profile.full_name
            return user.email

        return None

    def _read_user(self, user: User) -> AdminUserRead:
        psych_profile = self.user_repo.get_psychologist_profile(user.user_id)
        admin_profile = self.user_repo.get_admin_profile(user.user_id)

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

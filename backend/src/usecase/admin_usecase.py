import logging
import uuid

from sqlmodel import Session

from common.exceptions import ConflictError, NotFoundError
from models.psychologist_profile import PsychologistProfile
from models.user import User, UserRole
from repo.user_repo import UserRepository
from schemas.admin import AdminUserRead, PromotePsychologistRequest
from services.aws.cognito_service import CognitoService

logger = logging.getLogger("uvicorn.error")


class AdminUsecase:

    def __init__(self, service: CognitoService, db: Session):
        self.auth = service
        self.db = db
        self.user_repo = UserRepository(db)

    def list_users(self, role: UserRole, search: str | None = None) -> list[AdminUserRead]:
        return [
            self._read_user(user)
            for user in self.user_repo.list_users(role, search)
        ]

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

        username = self.auth.get_username_by_email(user.email)
        if username is None:
            raise NotFoundError("Cognito account not found for this user")

        previous_groups = set(self.auth.list_user_groups(username))
        self.auth.set_role_group(username, UserRole.PSYCHOLOGIST.value)

        try:
            profile = self.db.get(PsychologistProfile, user.user_id)
            if profile is None:
                profile = PsychologistProfile(
                    psychologist_id=user.user_id,
                    full_name=payload.full_name,
                )
                self.db.add(profile)

            data = payload.model_dump(exclude_unset=True)
            data.pop("full_name", None)
            if "social_media_links" in data:
                data["social_media_links"] = [
                    link.model_dump() for link in payload.social_media_links
                ]

            profile.full_name = payload.full_name
            for field, value in data.items():
                setattr(profile, field, value)

            user.role = UserRole.PSYCHOLOGIST.value
            self.db.add(user)
            self.db.commit()
        except Exception:
            self.db.rollback()
            try:
                self.auth.set_user_groups(username, previous_groups)
            except Exception:
                logger.exception(
                    "Failed to restore Cognito groups for %s after a failed "
                    "psychologist promotion", username,
                )
            raise

        self.db.refresh(profile)
        self.db.refresh(user)
        return self._read_user(user)

    def _read_user(self, user: User) -> AdminUserRead:
        profile = self.db.get(PsychologistProfile, user.user_id)

        return AdminUserRead(
            user_id=user.user_id,
            email=user.email,
            role=UserRole(user.role),
            full_name=profile.full_name if profile else None,
            created_at=user.created_at,
        )

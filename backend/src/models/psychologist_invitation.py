import uuid
from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PsychologistInvitation(SQLModel, table=True):
    __tablename__: str = "psychologist_invitations"

    invitation_id: uuid.UUID = Field(
        default_factory=uuid.uuid4,
        primary_key=True,
    )
    email: str = Field(index=True, nullable=False)
    token_hash: str = Field(unique=True, index=True, nullable=False)
    invited_by: uuid.UUID = Field(foreign_key="users.user_id", nullable=False)
    expires_at: datetime = Field(nullable=False)
    used_at: datetime | None = Field(default=None, nullable=True)
    revoked_at: datetime | None = Field(default=None, nullable=True)
    created_at: datetime = Field(default_factory=_utcnow, nullable=False)

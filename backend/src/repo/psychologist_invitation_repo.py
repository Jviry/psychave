import hashlib
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, update
from sqlmodel import Session, select

from models.psychologist_invitation import PsychologistInvitation


def hash_invitation_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.strip().encode("utf-8")).hexdigest()


class PsychologistInvitationRepo:
    def __init__(self, session: Session):
        self.session = session

    def get_by_raw_token(self, raw_token: str) -> PsychologistInvitation | None:
        if not raw_token or not raw_token.strip():
            return None
        token_hash = hash_invitation_token(raw_token)
        return self.session.exec(
            select(PsychologistInvitation).where(
                PsychologistInvitation.token_hash == token_hash
            )
        ).first()

    def revoke_pending_for_email(
        self, email: str, revoked_at: datetime | None = None
    ) -> None:
        now = revoked_at or datetime.now(timezone.utc)
        normalized = email.strip().lower()
        self.session.exec(
            update(PsychologistInvitation)
            .where(
                func.lower(PsychologistInvitation.email) == normalized,
                PsychologistInvitation.used_at.is_(None),
                PsychologistInvitation.revoked_at.is_(None),
            )
            .values(revoked_at=now)
        )
        self.session.flush()

    def create(
        self,
        *,
        email: str,
        raw_token: str,
        invited_by: uuid.UUID,
        expires_at: datetime,
    ) -> PsychologistInvitation:
        invitation = PsychologistInvitation(
            email=email.strip().lower(),
            token_hash=hash_invitation_token(raw_token),
            invited_by=invited_by,
            expires_at=expires_at,
        )
        self.session.add(invitation)
        self.session.commit()
        self.session.refresh(invitation)
        return invitation

    def mark_used(
        self,
        invitation: PsychologistInvitation,
        used_at: datetime | None = None,
    ) -> PsychologistInvitation:
        invitation.used_at = used_at or datetime.now(timezone.utc)
        self.session.add(invitation)
        self.session.commit()
        self.session.refresh(invitation)
        return invitation

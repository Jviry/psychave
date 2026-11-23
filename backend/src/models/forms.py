from datetime import datetime, timezone
from typing import Any
import uuid
import sqlalchemy as sa
from sqlmodel import Column, Field, SQLModel


class Forms(SQLModel, table=True):
    __tablename__: str = "forms"
    form_id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    profile_id: uuid.UUID = Field(foreign_key="profiles.profile_id")
    consent_version: str
    responses: dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(sa.JSON(), nullable=False),
    )
    signed_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    @property
    def terms_signer_name(self) -> str:
        return str((self.responses or {}).get("terms_signer_name", ""))

    @property
    def terms_signer_relation(self) -> str:
        return str((self.responses or {}).get("terms_signer_relation", "self"))

    @property
    def scope_acknowledged(self) -> bool:
        return bool((self.responses or {}).get("scope_acknowledged", False))

    @property
    def is_overseas_or_foreign(self) -> bool:
        return bool((self.responses or {}).get("is_overseas_or_foreign", False))

    @property
    def overseas_acknowledged(self) -> bool:
        return bool((self.responses or {}).get("overseas_acknowledged", False))

    @property
    def information_confirmed(self) -> bool:
        return bool((self.responses or {}).get("information_confirmed", False))

    @property
    def consent_signer_name(self) -> str:
        return str((self.responses or {}).get("consent_signer_name", ""))

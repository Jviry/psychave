import uuid
from sqlmodel import SQLModel, Field
from datetime import datetime, timezone


class Forms(SQLModel, table=True):
    __tablename__: str = "forms"
    form_id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    persona_id: uuid.UUID = Field(foreign_key="persona.persona_id")
    consent_version: str

    terms_signer_name: str
    # "self", "parent", "legal guardian"...
    terms_signer_relation: str
    scope_acknowledged: bool             # required
    is_overseas_or_foreign: bool = False
    overseas_acknowledged: bool = False  # must be True if is_overseas_or_foreign
    information_confirmed: bool          # the accuracy radio
    consent_signer_name: str             # final typed-name consent
    signed_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc))

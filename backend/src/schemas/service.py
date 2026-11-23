import uuid
from pydantic import field_validator
from sqlmodel import SQLModel


class ServiceRead(SQLModel):
    service_id: uuid.UUID
    name: str
    description: str
    is_active: bool
    duration_minutes: int
    guardrail_notice: str | None = None


class ServiceCreate(SQLModel):
    name: str
    description: str
    duration_minutes: int = 60
    guardrail_notice: str | None = None
    is_active: bool = True

    @field_validator("name", "description")
    @classmethod
    def not_blank(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field cannot be blank")
        return cleaned

    @field_validator("guardrail_notice")
    @classmethod
    def normalize_guardrail(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("duration_minutes")
    @classmethod
    def valid_duration(cls, value: int) -> int:
        if value < 15 or value > 480:
            raise ValueError("Duration must be between 15 and 480 minutes")
        return value


class ServiceUpdate(SQLModel):
    name: str | None = None
    description: str | None = None
    duration_minutes: int | None = None
    guardrail_notice: str | None = None
    is_active: bool | None = None

    @field_validator("name", "description")
    @classmethod
    def optional_not_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("Field cannot be blank")
        return cleaned

    @field_validator("guardrail_notice")
    @classmethod
    def normalize_guardrail(cls, value: str | None) -> str | None:
        if value is None:
            return None
        cleaned = value.strip()
        return cleaned or None

    @field_validator("duration_minutes")
    @classmethod
    def optional_valid_duration(cls, value: int | None) -> int | None:
        if value is None:
            return None
        if value < 15 or value > 480:
            raise ValueError("Duration must be between 15 and 480 minutes")
        return value

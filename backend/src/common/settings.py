from functools import lru_cache
from pathlib import Path
import re

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent
_PG_SCHEMA_RE = re.compile(r"^[a-z_][a-z0-9_]{0,62}$")


class Settings(BaseSettings):
    APP_NAME: str = "PsychAve API"
    ENV: str = "development"
    DEBUG: bool = False
    PORT: int = 8000
    HOST: str = "0.0.0.0"

    DATABASE_URL: str = ""
    DB_SCHEMA: str = ""

    CORS_ORIGINS: list[str] = []

    AWS_REGION: str = ""
    COGNITO_USER_POOL_ID: str = ""
    COGNITO_APP_CLIENT_ID: str = ""

    @field_validator("DB_SCHEMA")
    @classmethod
    def validate_db_schema(cls, v: str) -> str:
        schema = v.strip()
        if schema and not _PG_SCHEMA_RE.match(schema):
            raise ValueError(f"Invalid PostgreSQL schema identifier: {v!r}")
        return schema

    model_config = SettingsConfigDict(
        env_file=(BASE_DIR / ".env", ".env"),
        env_file_encoding="utf_8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Returns a cached singleton instance of Settings."""
    return Settings()


settings = get_settings()

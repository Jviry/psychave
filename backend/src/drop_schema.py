"""Drop an isolated PR ephemeral PostgreSQL schema on PR close.

Usage (from the ``backend/`` directory):

    DB_SCHEMA=pr_42 python src/drop_schema.py

Safety: strictly refuses any schema name that does not match ``^pr_[0-9]+$``,
making it impossible to drop ``public`` or internal Supabase schemas.
"""

import re

from sqlalchemy.pool import NullPool
from sqlmodel import create_engine

from common.settings import settings

_EPHEMERAL_PR_SCHEMA_RE = re.compile(r"^pr_[0-9]+$")


def validate_ephemeral_schema(schema: str) -> str:
    """Return ``schema`` if it is an ephemeral PR schema, else raise ``ValueError``."""
    candidate = schema.strip()
    if not _EPHEMERAL_PR_SCHEMA_RE.match(candidate):
        raise ValueError(
            f"Refusing to drop non-ephemeral schema {schema!r}; "
            "expected 'pr_<number>'."
        )
    return candidate


def drop_ephemeral_schema(schema: str | None = None) -> str:
    """Drop the validated ``pr_<number>`` schema with ``CASCADE``."""
    target = validate_ephemeral_schema(
        settings.DB_SCHEMA if schema is None else schema
    )
    if not settings.DATABASE_URL:
        raise ValueError("DATABASE_URL is required to drop an ephemeral schema.")

    admin_engine = create_engine(
        settings.DATABASE_URL,
        echo=False,
        poolclass=NullPool,
    )
    with admin_engine.connect() as conn:
        conn.exec_driver_sql(f'DROP SCHEMA IF EXISTS "{target}" CASCADE')
        conn.commit()

    return target


if __name__ == "__main__":
    dropped = drop_ephemeral_schema()
    print(f"Dropped ephemeral schema: {dropped}")

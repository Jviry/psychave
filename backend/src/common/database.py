from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.pool import NullPool
from sqlmodel import Session, create_engine

from common.settings import settings


def configure_engine_schema(target_engine: Engine, schema: str) -> None:
    """Scope every transaction on ``target_engine`` to ``schema``."""
    if not schema:
        return

    @event.listens_for(target_engine, "begin")
    def _set_search_path(conn) -> None:
        if conn.dialect.name == "postgresql":
            conn.exec_driver_sql(f'SET LOCAL search_path TO "{schema}"')


engine = create_engine(
    echo=settings.DEBUG,
    poolclass=NullPool,
)
configure_engine_schema(engine, settings.DB_SCHEMA)


def get_db():
    with Session(engine) as session:
        yield session

from sqlmodel import create_engine, Session
from sqlalchemy.pool import NullPool
from common.settings import settings

engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    poolclass=NullPool,
)


def get_db():
    with Session(engine) as session:
        yield session

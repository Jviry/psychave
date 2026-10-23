from sqlmodel import create_engine, Session
from sqlalchemy.pool import NullPool
from common.settings import settings

db_url = settings.DATABASE_URL if settings.DATABASE_URL else "sqlite:///:memory:"
engine = create_engine(
    db_url,
    echo=settings.DEBUG,
    poolclass=NullPool,
)


def get_db():
    with Session(engine) as session:
        yield session

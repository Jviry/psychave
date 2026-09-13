from sqlmodel import Session, text

from common.database import engine
from common.settings import settings

print(repr(settings.DATABASE_URL))
with engine.connect() as connection:
    result = connection.execute(text("SELECT 1"))
    print(result.scalar())

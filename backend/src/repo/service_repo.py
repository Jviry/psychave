from sqlmodel import Session, select
from models.service import Service


class ServiceRepo:
    def __init__(self, db: Session):
        self.db = db

    def get_all(self) -> list[Service]:
        return self.db.exec(select(Service)).all()

    def get_all_active(self) -> list[Service]:
        return self.db.exec(
            select(Service)
            .where(Service.is_active == True)  # noqa: E712
        ).all()

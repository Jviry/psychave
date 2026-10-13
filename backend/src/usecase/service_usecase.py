from sqlmodel import Session

from repo.service_repo import ServiceRepo
from models.service import Service


class ServiceUsecase:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ServiceRepo(db)

    def get_all(self) -> list[Service]:
        return self.repo.get_all()

    def get_all_active(self) -> list[Service]:
        return self.repo.get_all_active()

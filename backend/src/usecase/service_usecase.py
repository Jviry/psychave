import uuid
from sqlmodel import Session

from common.exceptions import NotFoundError
from repo.service_repo import ServiceRepo
from models.service import Service
from schemas.service import ServiceCreate, ServiceUpdate


class ServiceUsecase:
    def __init__(self, db: Session):
        self.db = db
        self.repo = ServiceRepo(db)

    def get_all(self) -> list[Service]:
        return self.repo.get_all()

    def get_all_active(self) -> list[Service]:
        return self.repo.get_all_active()

    def create_service(self, payload: ServiceCreate) -> Service:
        return self.repo.create(payload)

    def update_service(
        self, service_id: uuid.UUID, payload: ServiceUpdate
    ) -> Service:
        service = self.repo.get_by_id(service_id)
        if service is None:
            raise NotFoundError("Service not found")
        return self.repo.update(service, payload)

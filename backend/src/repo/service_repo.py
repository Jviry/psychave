import uuid
from sqlmodel import Session, select
from models.service import Service
from schemas.service import ServiceCreate, ServiceUpdate


class ServiceRepo:
    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, service_id: uuid.UUID) -> Service | None:
        return self.db.get(Service, service_id)

    def get_all(self) -> list[Service]:
        return list(self.db.exec(select(Service)).all())

    def get_all_active(self) -> list[Service]:
        return list(
            self.db.exec(
                select(Service).where(Service.is_active == True)  # noqa: E712
            ).all()
        )

    def create(self, data: ServiceCreate) -> Service:
        service = Service(**data.model_dump())
        self.db.add(service)
        self.db.commit()
        self.db.refresh(service)
        return service

    def update(self, service: Service, data: ServiceUpdate) -> Service:
        updates = data.model_dump(exclude_unset=True)
        for field, value in updates.items():
            setattr(service, field, value)
        self.db.add(service)
        self.db.commit()
        self.db.refresh(service)
        return service

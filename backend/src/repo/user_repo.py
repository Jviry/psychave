import uuid

from sqlmodel import Session, select

from models.user import User, UserRole


class UserRepository:

    def __init__(self, session: Session):
        self.session = session

    def get_by_id(self, user_id: uuid.UUID) -> User | None:
        return self.session.get(User, user_id)

    def get_by_cognito_sub(self, cognito_sub: str) -> User | None:
        return self.session.exec(
            select(User).where(User.cognito_sub == cognito_sub)
        ).first()

    def list_users(self, role: UserRole, search: str | None = None) -> list[User]:
        statement = select(User).where(User.role == role.value)

        search = (search or "").strip()
        if search:
            statement = statement.where(User.email.ilike(f"%{search}%"))

        statement = statement.order_by(User.created_at.desc())
        return list(self.session.exec(statement).all())

    def create(self, user: User) -> User:
        self.session.add(user)
        self.session.commit()
        self.session.refresh(user)
        return user

    def update(self, user: User) -> User:
        self.session.add(user)
        self.session.commit()
        self.session.refresh(user)
        return user

from sqlmodel import Session, select
from models.user import User


class UserRepository:

    def __init__(self, session: Session):
        self.session = session

    def get_by_sub(self, sub: str) -> User | None:
        """Fetch user by external auth identity subject."""
        return self.session.exec(
            select(User).where(User.cognito_sub == sub)
        ).first()

    def get_by_cognito_sub(self, cognito_sub: str) -> User | None:
        """Legacy alias for backward compatibility."""
        return self.get_by_sub(cognito_sub)

    def create(self, user: User) -> User:
        self.session.add(user)
        self.session.commit()
        self.session.refresh(user)
        return user

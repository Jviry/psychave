"""Domain errors for auth.

Raised by dependencies and usecases. Translated to HTTP responses by the
exception handlers in main.py — no FastAPI imports down here.
"""


class UnauthenticatedError(Exception):
    """Credentials missing, malformed, or token invalid/expired."""

    def __init__(self, message: str = "Not authenticated"):
        super().__init__(message)
        self.message = message


class UserNotFoundError(Exception):
    """Token is valid but has no matching row in users."""

    def __init__(self, message: str = "User not found"):
        super().__init__(message)
        self.message = message


class ForbiddenError(Exception):
    """Authenticated but missing a required Cognito group."""

    def __init__(self, message: str = "Insufficient permissions"):
        super().__init__(message)
        self.message = message


class DomainError(Exception):
    status_code: int = 500

    def __init__(self, detail: str, status_code: int | None = None):
        if status_code is not None:
            self.status_code = status_code
        self.detail = detail
        super().__init__(detail)


class NotFoundError(DomainError):
    status_code = 404

    def __init__(self, detail: str = "Not found"):
        super().__init__(detail)


class ValidationError(DomainError):
    status_code = 422

    def __init__(self, detail: str):
        super().__init__(detail)


class ConflictError(DomainError):
    status_code = 409

    def __init__(self, detail: str):
        super().__init__(detail)


class BadRequestError(DomainError):
    status_code = 400

    def __init__(self, detail: str):
        super().__init__(detail)

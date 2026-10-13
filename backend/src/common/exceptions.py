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

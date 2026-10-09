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

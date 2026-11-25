import threading
import time
import httpx
from jose import jwt, JWTError
from common.settings import settings

def _cognito_issuer() -> str:
    region = (
        settings.AWS_REGION
        or (
            settings.COGNITO_USER_POOL_ID.split("_", 1)[0]
            if "_" in settings.COGNITO_USER_POOL_ID
            else ""
        )
    )
    return (
        f"https://cognito-idp.{region}.amazonaws.com/"
        f"{settings.COGNITO_USER_POOL_ID}"
    )


COGNITO_ISSUER = _cognito_issuer()
JWKS_URL = f"{COGNITO_ISSUER}/.well-known/jwks.json"

_JWKS_TTL_SECONDS = 3600.0
_jwks_lock = threading.Lock()
_jwks_cache: list[dict] | None = None
_jwks_fetched_at = 0.0


def get_jwks(force_refresh: bool = False) -> list[dict]:
    global _jwks_cache, _jwks_fetched_at
    now = time.monotonic()
    with _jwks_lock:
        if (
            not force_refresh
            and _jwks_cache is not None
            and (now - _jwks_fetched_at) < _JWKS_TTL_SECONDS
        ):
            return _jwks_cache
        response = httpx.get(JWKS_URL, timeout=5.0)
        response.raise_for_status()
        _jwks_cache = response.json()["keys"]
        _jwks_fetched_at = now
        return _jwks_cache


def verify_token(token: str) -> dict:
    """Validate a Cognito **ID token** and return its claims.

    Send the ID token in ``Authorization: Bearer <id_token>`` — access
    tokens are rejected because they carry ``client_id`` instead of ``aud``.
    (The gateway authorizer accepts both; the app only accepts ID tokens.)
    """
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid")
    jwks = get_jwks()
    key = next((k for k in jwks if k.get("kid") == kid), None)

    if key is None:
        jwks = get_jwks(force_refresh=True)
        key = next((k for k in jwks if k.get("kid") == kid), None)

    if key is None:
        raise JWTError("Public key not found for token")

    claims = jwt.decode(
        token,
        key,
        algorithms=["RS256"],
        audience=settings.COGNITO_APP_CLIENT_ID,
        issuer=COGNITO_ISSUER,
        options={"verify_at_hash": False},
    )
    if claims.get("token_use") != "id":
        raise JWTError("Token is not a Cognito ID token")
    return claims

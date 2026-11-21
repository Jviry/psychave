import httpx
from jose import jwt, JWTError
from functools import lru_cache
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


@lru_cache
def get_jwks():
    # cached — Cognito's public keys rarely rotate, no need to fetch every request
    response = httpx.get(JWKS_URL)
    response.raise_for_status()
    return response.json()["keys"]


def verify_token(token: str) -> dict:
    """Validate a Cognito **ID token** and return its claims.

    Send the ID token in ``Authorization: Bearer <id_token>`` — access
    tokens are rejected because they carry ``client_id`` instead of ``aud``.
    (The gateway authorizer accepts both; the app only accepts ID tokens.)
    """
    jwks = get_jwks()
    unverified_header = jwt.get_unverified_header(token)
    key = next((k for k in jwks if k["kid"] == unverified_header["kid"]), None)

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
    return claims

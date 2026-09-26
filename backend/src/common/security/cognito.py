import httpx
from jose import jwt, JWTError
from functools import lru_cache
from common.settings import settings

COGNITO_ISSUER = f"https://cognito-idp.{
    settings.AWS_REGION}.amazonaws.com/{settings.COGNITO_USER_POOL_ID}"
JWKS_URL = f"{COGNITO_ISSUER}/.well-known/jwks.json"


@lru_cache
def get_jwks():
    # cached — Cognito's public keys rarely rotate, no need to fetch every request
    response = httpx.get(JWKS_URL)
    response.raise_for_status()
    return response.json()["keys"]


def verify_token(token: str) -> dict:
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
    )
    return claims

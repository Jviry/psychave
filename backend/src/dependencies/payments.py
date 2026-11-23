"""Payment provider wiring. Configures PayMongo for production MVP."""
from functools import lru_cache
from typing import Annotated

from fastapi import Depends

from common.settings import settings
from interfaces.payment import PaymentProvider
from services.payments.paymongo_provider import PayMongoPaymentProvider


@lru_cache
def _init_provider() -> PaymentProvider:
    if not settings.PAYMONGO_SECRET_KEY.strip():
        raise RuntimeError(
            "PAYMONGO_SECRET_KEY must be configured to initialize PayMongoPaymentProvider"
        )
    return PayMongoPaymentProvider(
        secret_key=settings.PAYMONGO_SECRET_KEY,
        public_key=settings.PAYMONGO_PUBLIC_KEY,
        webhook_secret=settings.PAYMONGO_WEBHOOK_SECRET,
        api_base_url=settings.PAYMONGO_API_BASE_URL,
    )


def get_payment_provider() -> PaymentProvider:
    return _init_provider()


PaymentProviderDep = Annotated[PaymentProvider, Depends(get_payment_provider)]

__all__ = ["get_payment_provider", "PaymentProviderDep"]

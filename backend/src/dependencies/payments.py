"""Payment provider wiring. Configures PayMongo or Fake based on environment."""
from functools import lru_cache

from common.settings import settings
from interfaces.payment import PaymentProvider
from services.payments.fake_provider import FakePaymentProvider
from services.payments.paymongo_provider import PayMongoPaymentProvider


@lru_cache
def _init_provider() -> PaymentProvider:
    provider_name = (settings.PAYMENT_PROVIDER or "").lower().strip()

    use_paymongo = (
        provider_name == "paymongo"
        or (not provider_name and settings.ENV == "production")
    )

    if use_paymongo:
        return PayMongoPaymentProvider(
            secret_key=settings.PAYMONGO_SECRET_KEY,
            public_key=settings.PAYMONGO_PUBLIC_KEY,
            webhook_secret=settings.PAYMONGO_WEBHOOK_SECRET,
            api_base_url=settings.PAYMONGO_API_BASE_URL,
        )
    return FakePaymentProvider()


def get_payment_provider() -> PaymentProvider:
    return _init_provider()

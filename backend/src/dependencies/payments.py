"""Payment provider wiring. Swap the return value when PayMongo lands."""
from services.payments.base import PaymentProvider
from services.payments.fake_provider import FakePaymentProvider

_provider = FakePaymentProvider()


def get_payment_provider() -> PaymentProvider:
    return _provider

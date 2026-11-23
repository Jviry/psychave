"""Payment provider interface (port).

The application talks only to PaymentProvider. Gateways (PayMongo, Stripe, fake, ...)
plug in as implementations without controller or usecase changes.
"""
from dataclasses import dataclass
from typing import Mapping, Protocol


@dataclass(frozen=True)
class InitiatedPayment:
    provider_ref: str
    checkout_url: str | None = None


@dataclass(frozen=True)
class WebhookEvent:
    provider_ref: str
    paid: bool
    payment_method: str | None = None


class PaymentProvider(Protocol):
    name: str

    def create_checkout(
        self,
        *,
        amount: float,
        currency: str,
        reference: str,
        description: str,
        success_url: str | None = None,
        cancel_url: str | None = None,
    ) -> InitiatedPayment:
        """Create a checkout with the gateway. No network in fake impl."""
        ...

    def verify_signature(self, raw_body: bytes, headers: Mapping[str, str]) -> bool:
        """Verify a webhook callback is genuinely from the gateway."""
        ...

    def parse_webhook(
        self, raw_body: bytes, headers: Mapping[str, str]
    ) -> WebhookEvent | None:
        """Parse raw webhook bytes & headers into a normalized WebhookEvent."""
        ...

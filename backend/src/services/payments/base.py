"""Payment provider seam.

The API talks only to PaymentProvider. Real gateways (PayMongo, Stripe, …)
plug in later as new implementations — no controller/usecase changes needed.
"""
from dataclasses import dataclass
from typing import Mapping, Protocol


@dataclass(frozen=True)
class InitiatedPayment:
    provider_ref: str
    checkout_url: str | None = None


class PaymentProvider(Protocol):
    name: str

    def create_checkout(
        self,
        *,
        amount: float,
        currency: str,
        reference: str,
        description: str,
    ) -> InitiatedPayment:
        """Create a checkout with the gateway. No network in fake impl."""
        ...

    def verify_signature(self, raw_body: bytes, headers: Mapping[str, str]) -> bool:
        """Verify a webhook callback is genuinely from the gateway."""
        ...

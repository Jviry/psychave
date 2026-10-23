"""Offline stand-in for a real gateway. Flow-only, no network.

Swap for PayMongoProvider later — same PaymentProvider interface.
"""
import json
import uuid
from typing import Mapping

from services.payments.base import InitiatedPayment, WebhookEvent


class FakePaymentProvider:
    name = "fake"
    checkout_base_url = "https://pay.local/checkout"

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
        ref = f"fake_{uuid.uuid4().hex[:12]}"
        return InitiatedPayment(
            provider_ref=ref,
            checkout_url=f"{self.checkout_base_url}/{ref}",
        )

    def verify_signature(self, raw_body: bytes, headers: Mapping[str, str]) -> bool:
        return True

    def parse_webhook(
        self, raw_body: bytes, headers: Mapping[str, str]
    ) -> WebhookEvent | None:
        try:
            data = json.loads(raw_body.decode("utf-8"))
            return WebhookEvent(
                provider_ref=data.get("provider_ref", ""),
                paid=data.get("outcome") == "paid",
                payment_method=data.get("payment_method"),
            )
        except Exception:
            return None

"""PayMongo payment provider implementation.

Integrates with PayMongo Checkout Sessions API and handles PayMongo webhook
signature verification and payload parsing.
"""
import base64
import hashlib
import hmac
import json
import logging
import time
from typing import Mapping, Sequence

import httpx

from common.exceptions import BadRequestError
from services.payments.base import InitiatedPayment, WebhookEvent

logger = logging.getLogger(__name__)

DEFAULT_PAYMENT_METHODS: tuple[str, ...] = (
    "card",
    "gcash",
    "paymaya",
    "qrph",
    "grab_pay",
)


class PayMongoPaymentProvider:
    name = "paymongo"

    def __init__(
        self,
        *,
        secret_key: str,
        public_key: str = "",
        webhook_secret: str = "",
        api_base_url: str = "https://api.paymongo.com/v1",
        payment_methods: Sequence[str] = DEFAULT_PAYMENT_METHODS,
        client: httpx.Client | None = None,
    ):
        self.secret_key = secret_key
        self.public_key = public_key
        self.webhook_secret = webhook_secret
        self.api_base_url = api_base_url.rstrip("/")
        self.payment_methods = list(payment_methods)
        self._client = client

    def _get_auth_header(self) -> str:
        # PayMongo uses HTTP Basic Auth with the secret key as username and empty password
        token = base64.b64encode(
            f"{self.secret_key}:".encode("utf-8")).decode("utf-8")
        return f"Basic {token}"

    def create_checkout(
        self,
        *,
        amount: float,
        currency: str = "PHP",
        reference: str,
        description: str,
        success_url: str | None = None,
        cancel_url: str | None = None,
    ) -> InitiatedPayment:
        if not self.secret_key:
            raise BadRequestError("PayMongo secret key is not configured")

        # PayMongo expects amounts in integer cents/centavos (e.g. 1500.00 PHP -> 150000)
        amount_in_cents = int(round(amount * 100))
        if amount_in_cents <= 0:
            raise BadRequestError("Payment amount must be greater than zero")

        attributes: dict[str, object] = {
            "send_email_receipt": False,
            "show_description": True,
            "show_line_items": True,
            "description": description,
            "line_items": [
                {
                    "currency": currency,
                    "amount": amount_in_cents,
                    "name": description,
                    "quantity": 1,
                }
            ],
            "payment_method_types": self.payment_methods,
            "reference_number": reference,
        }

        if success_url:
            attributes["success_url"] = success_url
        if cancel_url:
            attributes["cancel_url"] = cancel_url

        payload = {"data": {"attributes": attributes}}
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": self._get_auth_header(),
        }

        url = f"{self.api_base_url}/checkout_sessions"

        try:
            if self._client is not None:
                response = self._client.post(
                    url, json=payload, headers=headers, timeout=20.0)
            else:
                with httpx.Client(timeout=20.0) as client:
                    response = client.post(url, json=payload, headers=headers)
        except Exception as exc:
            logger.error("Failed to connect to PayMongo API: %s", exc)
            raise BadRequestError(
                f"Could not reach payment gateway: {exc}") from exc

        if response.status_code >= 400:
            logger.error(
                "PayMongo checkout creation failed: %d - %s",
                response.status_code,
                response.text,
            )
            detail = "Payment gateway rejected the checkout request"
            try:
                err_data = response.json()
                errors = err_data.get("errors")
                if errors and isinstance(errors, list):
                    detail = errors[0].get("detail", detail)
            except Exception:
                pass
            raise BadRequestError(detail)

        data = response.json().get("data", {})
        provider_ref = data.get("id")
        checkout_url = data.get("attributes", {}).get("checkout_url")

        if not provider_ref or not checkout_url:
            raise BadRequestError(
                "Malformed response received from payment gateway")

        return InitiatedPayment(provider_ref=provider_ref, checkout_url=checkout_url)

    def verify_signature(
        self,
        raw_body: bytes,
        headers: Mapping[str, str],
        *,
        tolerance_seconds: int = 300,
    ) -> bool:
        if not self.webhook_secret:
            logger.warning(
                "PayMongo webhook verification failed: no webhook secret configured")
            return False

        # Paymongo-Signature header: t=...,te=...,li=...
        sig_header = None
        for key, val in headers.items():
            if key.lower() == "paymongo-signature":
                sig_header = val
                break

        if not sig_header:
            return False

        header_dict: dict[str, str] = {}
        for part in sig_header.split(","):
            if "=" in part:
                k, v = part.split("=", 1)
                header_dict[k.strip()] = v.strip()

        timestamp_str = header_dict.get("t")
        if not timestamp_str:
            return False

        try:
            timestamp = int(timestamp_str)
        except ValueError:
            return False

        # Check timestamp drift to prevent replay attacks
        if tolerance_seconds > 0:
            if abs(time.time() - timestamp) > tolerance_seconds:
                logger.warning(
                    "PayMongo webhook signature timestamp expired or skewed")
                return False

        # PayMongo sends 'te' for test mode, 'li' for live mode
        signatures_to_test = [
            header_dict[k] for k in ("li", "te") if k in header_dict
        ]
        if not signatures_to_test:
            return False

        body_str = raw_body.decode("utf-8")
        signed_payload = f"{timestamp_str}.{body_str}"
        computed_sig = hmac.new(
            self.webhook_secret.encode("utf-8"),
            signed_payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        return any(hmac.compare_digest(computed_sig, sig) for sig in signatures_to_test)

    def parse_webhook(
        self, raw_body: bytes, headers: Mapping[str, str]
    ) -> WebhookEvent | None:
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except Exception as exc:
            logger.warning("Failed to parse webhook JSON: %s", exc)
            return None

        data = payload.get("data", {})
        attributes = data.get("attributes", {})
        event_type = attributes.get("type")

        event_data = attributes.get("data", {})
        session_id = event_data.get("id")
        session_attrs = event_data.get("attributes", {})

        # Handle checkout_session.payment.paid
        if event_type == "checkout_session.payment.paid":
            payments = session_attrs.get("payments", [])
            payment_method = None
            if payments and isinstance(payments, list):
                first_payment = payments[0]
                p_attrs = first_payment.get("attributes", {})
                source = p_attrs.get("source", {})
                payment_method = source.get(
                    "type") or p_attrs.get("payment_method_type")

            return WebhookEvent(
                provider_ref=session_id or "",
                paid=True,
                payment_method=payment_method,
            )

        # Handle failed or expired checkout session if emitted
        if event_type in ("checkout_session.payment.failed", "checkout_session.expired"):
            return WebhookEvent(
                provider_ref=session_id or "",
                paid=False,
                payment_method=None,
            )

        logger.info("Ignoring unhandled PayMongo event type: %s", event_type)
        return None

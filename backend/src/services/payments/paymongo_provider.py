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

from common.exceptions import BadRequestError, ServiceUnavailableError
from services.payments.base import InitiatedPayment, RefundResult, WebhookEvent

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
            raise ServiceUnavailableError(
                "Payment gateway is temporarily unreachable. Please contact your assigned psychologist to arrange manual payment or try again shortly."
            ) from exc

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
            if response.status_code >= 500 or "maintenance" in detail.lower():
                raise ServiceUnavailableError(
                    "Payment gateway is temporarily under maintenance. Please contact your assigned psychologist to arrange manual payment or try again shortly."
                )
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
            gateway_payment_id = None
            if payments and isinstance(payments, list):
                first_payment = payments[0]
                gateway_payment_id = first_payment.get("id")
                p_attrs = first_payment.get("attributes", {})
                source = p_attrs.get("source", {})
                payment_method = source.get(
                    "type") or p_attrs.get("payment_method_type")

            return WebhookEvent(
                provider_ref=session_id or "",
                paid=True,
                payment_method=payment_method,
                gateway_payment_id=gateway_payment_id,
                event_type=event_type,
            )

        # Handle failed or expired checkout session if emitted
        if event_type in ("checkout_session.payment.failed", "checkout_session.expired"):
            return WebhookEvent(
                provider_ref=session_id or "",
                paid=False,
                payment_method=None,
                event_type=event_type,
            )

        # Handle payment.refunded / payment.refund.updated
        if event_type in ("payment.refunded", "payment.refund.updated"):
            if event_data.get("type") == "payment":
                payment_id = session_id or ""
                refunds = session_attrs.get("refunds") or []
                latest_refund = refunds[-1] if isinstance(refunds, list) and refunds else {}
                refund_attrs = (
                    latest_refund.get("attributes", {})
                    if isinstance(latest_refund, dict)
                    else {}
                )
                refund_id = latest_refund.get("id") if isinstance(latest_refund, dict) else None
                refund_status = refund_attrs.get("status")
                non_failed_total = sum(
                    int(r.get("attributes", {}).get("amount", 0) or 0)
                    for r in refunds
                    if isinstance(r, dict)
                    and r.get("attributes", {}).get("status") != "failed"
                )
                amount_centavos = (
                    non_failed_total
                    if non_failed_total > 0
                    else refund_attrs.get("amount")
                )
            else:
                refund_id = event_data.get("id")
                payment_id = session_attrs.get("payment_id") or session_id or ""
                amount_centavos = session_attrs.get("amount")
                refund_status = session_attrs.get("status")
            return WebhookEvent(
                provider_ref=payment_id,
                paid=True,
                gateway_payment_id=payment_id,
                event_type=event_type,
                refund_id=refund_id,
                refund_amount_centavos=amount_centavos,
                refund_status=refund_status,
            )

        logger.info("Ignoring unhandled PayMongo event type: %s", event_type)
        return None

    def fetch_checkout_status(self, provider_ref: str) -> WebhookEvent | None:
        """Query PayMongo directly for a checkout session's current payment state.

        Used as a server-side fallback when the client returns to the app before
        a webhook arrives (or when webhooks are delayed/missed).
        """
        if not self.secret_key or not provider_ref:
            return None

        url = f"{self.api_base_url}/checkout_sessions/{provider_ref}"
        headers = {
            "Accept": "application/json",
            "Authorization": self._get_auth_header(),
        }

        try:
            if self._client is not None:
                response = self._client.get(url, headers=headers, timeout=10.0)
            else:
                with httpx.Client(timeout=10.0) as client:
                    response = client.get(url, headers=headers)
        except Exception as exc:
            logger.warning(
                "Failed to fetch PayMongo checkout session %s: %s",
                provider_ref,
                exc,
            )
            return None

        if response.status_code != 200:
            logger.warning(
                "PayMongo checkout session lookup returned %d for %s",
                response.status_code,
                provider_ref,
            )
            return None

        try:
            attrs = response.json().get("data", {}).get("attributes", {})
        except Exception:
            return None

        payments = attrs.get("payments") or []
        payment_intent = attrs.get("payment_intent") or {}
        pi_status = payment_intent.get("attributes", {}).get("status")
        has_paid_payment = any(
            isinstance(p, dict) and p.get("attributes", {}).get("status") == "paid"
            for p in payments
        )

        if pi_status == "succeeded" or has_paid_payment:
            payment_method = None
            gateway_payment_id = None
            if payments and isinstance(payments, list) and isinstance(payments[0], dict):
                gateway_payment_id = payments[0].get("id")
                p_attrs = payments[0].get("attributes", {})
                source = p_attrs.get("source") or {}
                payment_method = source.get("type") or p_attrs.get("payment_method_type")
            return WebhookEvent(
                provider_ref=provider_ref,
                paid=True,
                payment_method=payment_method,
                gateway_payment_id=gateway_payment_id,
                event_type="checkout_session.payment.paid",
            )

        if attrs.get("status") == "expired" or pi_status == "failed":
            return WebhookEvent(
                provider_ref=provider_ref,
                paid=False,
                payment_method=None,
            )

        return None

    def create_refund(
        self,
        *,
        payment_id: str,
        amount_centavos: int,
        reason: str = "requested_by_customer",
        notes: str | None = None,
    ) -> RefundResult:
        if not self.secret_key:
            raise BadRequestError("PayMongo secret key is not configured")
        if amount_centavos <= 0:
            raise BadRequestError("Refund amount must be greater than zero")
        if not payment_id:
            raise BadRequestError("PayMongo payment ID is required for refund")

        allowed_reasons = {"duplicate", "fraudulent", "requested_by_customer", "others"}
        paymongo_reason = reason if reason in allowed_reasons else "requested_by_customer"
        attributes: dict[str, object] = {
            "amount": int(amount_centavos),
            "payment_id": payment_id,
            "reason": paymongo_reason,
        }
        if notes:
            attributes["notes"] = notes
        elif reason not in allowed_reasons:
            attributes["notes"] = reason

        payload = {"data": {"attributes": attributes}}
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": self._get_auth_header(),
        }
        url = f"{self.api_base_url}/refunds"

        try:
            if self._client is not None:
                response = self._client.post(
                    url, json=payload, headers=headers, timeout=20.0
                )
            else:
                with httpx.Client(timeout=20.0) as client:
                    response = client.post(url, json=payload, headers=headers)
        except Exception as exc:
            logger.error("Failed to connect to PayMongo Refunds API: %s", exc)
            raise ServiceUnavailableError(
                "Payment gateway is temporarily unreachable while processing refund."
            ) from exc

        if response.status_code >= 400:
            logger.error(
                "PayMongo refund creation failed: %d - %s",
                response.status_code,
                response.text,
            )
            detail = "Payment gateway rejected the refund request"
            try:
                err_data = response.json()
                errors = err_data.get("errors")
                if errors and isinstance(errors, list):
                    detail = errors[0].get("detail", detail)
            except Exception:
                pass
            if response.status_code >= 500 or "maintenance" in detail.lower():
                raise ServiceUnavailableError(
                    "Payment gateway is temporarily under maintenance."
                )
            raise BadRequestError(detail)

        data = response.json().get("data", {})
        refund_id = data.get("id") or ""
        refund_attrs = data.get("attributes", {})
        status = refund_attrs.get("status") or "pending"
        refunded_amount = int(refund_attrs.get("amount") or amount_centavos)
        if not refund_id:
            raise BadRequestError("Malformed refund response from payment gateway")

        return RefundResult(
            refund_id=refund_id,
            status=status,
            amount_centavos=refunded_amount,
        )

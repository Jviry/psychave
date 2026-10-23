import base64
import hashlib
import hmac
import json
import time
import httpx
import pytest

from common.exceptions import BadRequestError
from services.payments.base import InitiatedPayment, WebhookEvent
from services.payments.paymongo_provider import PayMongoPaymentProvider


class TestPayMongoPaymentProvider:
    @pytest.fixture
    def provider(self):
        return PayMongoPaymentProvider(
            secret_key="sk_test_1234567890",
            public_key="pk_test_0987654321",
            webhook_secret="whsk_test_secret_key_123",
            api_base_url="https://api.paymongo.com/v1",
        )

    # ----- create_checkout tests -----
    def test_create_checkout_success(self, provider):
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url == "https://api.paymongo.com/v1/checkout_sessions"
            assert request.headers["Accept"] == "application/json"
            assert request.headers["Content-Type"] == "application/json"

            # Check basic auth header
            expected_auth = base64.b64encode(b"sk_test_1234567890:").decode("utf-8")
            assert request.headers["Authorization"] == f"Basic {expected_auth}"

            body = json.loads(request.content.decode("utf-8"))
            attrs = body["data"]["attributes"]
            assert attrs["reference_number"] == "appt_123"
            assert attrs["description"] == "Appointment 123"
            # Amount 1500.50 PHP -> 150050 cents
            assert attrs["line_items"][0]["amount"] == 150050
            assert attrs["line_items"][0]["currency"] == "PHP"
            assert attrs["payment_method_types"] == ["card", "gcash", "paymaya", "qrph", "grab_pay"]
            assert attrs["success_url"] == "http://localhost:3000/proposal/123?payment=success"
            assert attrs["cancel_url"] == "http://localhost:3000/proposal/123?payment=cancelled"

            resp_data = {
                "data": {
                    "id": "cs_test_sample_session_id",
                    "type": "checkout_session",
                    "attributes": {
                        "checkout_url": "https://checkout.paymongo.com/cs_test_sample_session_id"
                    },
                }
            }
            return httpx.Response(200, json=resp_data)

        transport = httpx.MockTransport(handler)
        provider._client = httpx.Client(transport=transport)

        res = provider.create_checkout(
            amount=1500.50,
            currency="PHP",
            reference="appt_123",
            description="Appointment 123",
            success_url="http://localhost:3000/proposal/123?payment=success",
            cancel_url="http://localhost:3000/proposal/123?payment=cancelled",
        )

        assert isinstance(res, InitiatedPayment)
        assert res.provider_ref == "cs_test_sample_session_id"
        assert res.checkout_url == "https://checkout.paymongo.com/cs_test_sample_session_id"

    def test_create_checkout_missing_secret_key(self):
        p = PayMongoPaymentProvider(secret_key="")
        with pytest.raises(BadRequestError, match="secret key is not configured"):
            p.create_checkout(amount=100.0, reference="ref", description="desc")

    def test_create_checkout_invalid_amount(self, provider):
        with pytest.raises(BadRequestError, match="greater than zero"):
            provider.create_checkout(amount=0.0, reference="ref", description="desc")

    def test_create_checkout_api_error_handling(self, provider):
        def handler(request: httpx.Request) -> httpx.Response:
            return httpx.Response(
                400,
                json={
                    "errors": [
                        {
                            "code": "parameter_invalid",
                            "detail": "Amount must be at least 10000 cents.",
                        }
                    ]
                },
            )

        transport = httpx.MockTransport(handler)
        provider._client = httpx.Client(transport=transport)

        with pytest.raises(BadRequestError, match="Amount must be at least 10000 cents"):
            provider.create_checkout(amount=50.0, reference="ref", description="desc")

    # ----- verify_signature tests -----
    def test_verify_signature_valid(self, provider):
        now = int(time.time())
        raw_body = b'{"data": {"type": "event"}}'
        signed_payload = f"{now}.{raw_body.decode('utf-8')}"
        computed_sig = hmac.new(
            b"whsk_test_secret_key_123",
            signed_payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        headers = {
            "Paymongo-Signature": f"t={now},te={computed_sig}"
        }

        assert provider.verify_signature(raw_body, headers) is True

    def test_verify_signature_invalid_sig(self, provider):
        now = int(time.time())
        raw_body = b'{"data": {"type": "event"}}'
        headers = {
            "Paymongo-Signature": f"t={now},te=fakeinvalidhash123456"
        }
        assert provider.verify_signature(raw_body, headers) is False

    def test_verify_signature_expired_timestamp(self, provider):
        expired_time = int(time.time()) - 1000
        raw_body = b'{"data": {"type": "event"}}'
        signed_payload = f"{expired_time}.{raw_body.decode('utf-8')}"
        computed_sig = hmac.new(
            b"whsk_test_secret_key_123",
            signed_payload.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        headers = {
            "Paymongo-Signature": f"t={expired_time},te={computed_sig}"
        }
        assert provider.verify_signature(raw_body, headers, tolerance_seconds=300) is False

    def test_verify_signature_missing_header(self, provider):
        assert provider.verify_signature(b"{}", {}) is False

    # ----- parse_webhook tests -----
    def test_parse_webhook_checkout_session_paid(self, provider):
        payload = {
            "data": {
                "id": "evt_test123",
                "type": "event",
                "attributes": {
                    "type": "checkout_session.payment.paid",
                    "data": {
                        "id": "cs_test_session_999",
                        "type": "checkout_session",
                        "attributes": {
                            "payments": [
                                {
                                    "id": "pay_test_888",
                                    "attributes": {
                                        "status": "paid",
                                        "source": {"type": "gcash"},
                                    },
                                }
                            ]
                        },
                    },
                },
            }
        }
        raw_body = json.dumps(payload).encode("utf-8")
        event = provider.parse_webhook(raw_body, {})

        assert isinstance(event, WebhookEvent)
        assert event.provider_ref == "cs_test_session_999"
        assert event.paid is True
        assert event.payment_method == "gcash"

    def test_parse_webhook_checkout_session_failed(self, provider):
        payload = {
            "data": {
                "id": "evt_test123",
                "type": "event",
                "attributes": {
                    "type": "checkout_session.payment.failed",
                    "data": {
                        "id": "cs_test_session_999",
                        "type": "checkout_session",
                        "attributes": {},
                    },
                },
            }
        }
        raw_body = json.dumps(payload).encode("utf-8")
        event = provider.parse_webhook(raw_body, {})

        assert isinstance(event, WebhookEvent)
        assert event.provider_ref == "cs_test_session_999"
        assert event.paid is False
        assert event.payment_method is None

    def test_parse_webhook_unhandled_event(self, provider):
        payload = {
            "data": {
                "type": "event",
                "attributes": {"type": "customer.created"},
            }
        }
        raw_body = json.dumps(payload).encode("utf-8")
        assert provider.parse_webhook(raw_body, {}) is None

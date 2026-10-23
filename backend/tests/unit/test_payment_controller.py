import uuid
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from fastapi import FastAPI
from sqlmodel import Session
import pytest

from controllers.payment_controller import router as payment_router
from dependencies.payments import get_payment_provider, _init_provider
from common.database import get_db
from common.settings import settings
from models.payment import Payment, PaymentStatus
from models.appointment import Appointment, AppointmentStatus
from services.payments.base import PaymentProvider, WebhookEvent
from services.payments.fake_provider import FakePaymentProvider
from services.payments.paymongo_provider import PayMongoPaymentProvider


class DummyProvider:
    name = "dummy"

    def __init__(self, verify=True, event=None):
        self.verify = verify
        self.event = event

    def create_checkout(self, **kwargs):
        raise NotImplementedError

    def verify_signature(self, raw_body, headers):
        return self.verify

    def parse_webhook(self, raw_body, headers):
        return self.event


class TestPaymentController:
    @pytest.fixture
    def app(self):
        test_app = FastAPI()
        test_app.include_router(payment_router, prefix="/payments")
        return test_app

    def test_provider_selection_logic(self, monkeypatch):
        _init_provider.cache_clear()
        monkeypatch.setattr(settings, "ENV", "development")
        monkeypatch.setattr(settings, "PAYMENT_PROVIDER", None)
        assert isinstance(_init_provider(), FakePaymentProvider)

        _init_provider.cache_clear()
        monkeypatch.setattr(settings, "ENV", "production")
        monkeypatch.setattr(settings, "PAYMENT_PROVIDER", None)
        monkeypatch.setattr(settings, "PAYMONGO_SECRET_KEY", "sk_test_123")
        assert isinstance(_init_provider(), PayMongoPaymentProvider)

        _init_provider.cache_clear()
        monkeypatch.setattr(settings, "ENV", "development")
        monkeypatch.setattr(settings, "PAYMENT_PROVIDER", "paymongo")
        assert isinstance(_init_provider(), PayMongoPaymentProvider)

        _init_provider.cache_clear()

    def test_webhook_invalid_signature_returns_401(self, app):
        dummy_db = MagicMock(spec=Session)
        app.dependency_overrides[get_db] = lambda: dummy_db
        app.dependency_overrides[get_payment_provider] = lambda: DummyProvider(verify=False)

        client = TestClient(app)
        res = client.post("/payments/webhook", content=b"{}")
        assert res.status_code == 401
        assert res.json()["detail"] == "Invalid webhook signature"

    def test_webhook_ignored_event_returns_200(self, app):
        dummy_db = MagicMock(spec=Session)
        app.dependency_overrides[get_db] = lambda: dummy_db
        app.dependency_overrides[get_payment_provider] = lambda: DummyProvider(verify=True, event=None)

        client = TestClient(app)
        res = client.post("/payments/webhook", content=b'{"type": "customer.created"}')
        assert res.status_code == 200
        assert res.json() == {"status": "ignored"}

    def test_webhook_paid_event_updates_payment_and_appointment(self, app):
        dummy_db = MagicMock(spec=Session)
        appt_id = uuid.uuid4()
        payment_record = Payment(
            payment_id=uuid.uuid4(),
            appointment_id=appt_id,
            amount=1500.0,
            provider="paymongo",
            provider_ref="cs_test_session_1",
            status=PaymentStatus.PENDING,
        )
        appointment_record = Appointment(
            appointment_id=appt_id,
            persona_id=uuid.uuid4(),
            psychologist_id=uuid.uuid4(),
            status=AppointmentStatus.AWAITING_PAYMENT,
            price=1500.0,
        )

        app.dependency_overrides[get_db] = lambda: dummy_db
        app.dependency_overrides[get_payment_provider] = lambda: DummyProvider(
            verify=True,
            event=WebhookEvent(
                provider_ref="cs_test_session_1",
                paid=True,
                payment_method="gcash",
            ),
        )

        # Mock repository operations through dummy_db
        # In PaymentRepo.get_by_provider_ref:
        mock_exec = MagicMock()
        mock_exec.first.return_value = payment_record
        dummy_db.exec.return_value = mock_exec
        dummy_db.get.return_value = appointment_record

        client = TestClient(app)
        res = client.post("/payments/webhook", content=b'{"valid": "json"}')
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "paid"
        assert data["payment_method"] == "gcash"
        assert appointment_record.status == AppointmentStatus.CONFIRMED

from datetime import datetime, timedelta
import uuid
from unittest.mock import MagicMock
from sqlmodel import Session
import pytest

from common.exceptions import BadRequestError, NotFoundError
from common.time import now_manila
from models.appointment import Appointment, AppointmentStatus
from models.payment import Payment, PaymentStatus
from models.profile import Profile
from services.payments.base import InitiatedPayment
from usecase.payment_usecase import PaymentUsecase


class MockPaymentProvider:
    name = "paymongo"

    def __init__(self):
        self.created_checkouts = []

    def create_checkout(self, **kwargs):
        self.created_checkouts.append(kwargs)
        return InitiatedPayment(
            provider_ref="cs_mock_12345",
            checkout_url="https://checkout.paymongo.com/cs_mock_12345",
        )

    def verify_signature(self, raw_body, headers):
        return True

    def parse_webhook(self, raw_body, headers):
        return None


class TestPaymentUsecase:
    @pytest.fixture
    def db(self):
        return MagicMock(spec=Session)

    @pytest.fixture
    def provider(self):
        return MockPaymentProvider()

    def test_initiate_payment_success_with_defaults(self, db, provider):
        client_id = uuid.uuid4()
        appt_id = uuid.uuid4()
        profile_id = uuid.uuid4()

        appt = Appointment(
            appointment_id=appt_id,
            profile_id=profile_id,
            psychologist_id=uuid.uuid4(),
            status=AppointmentStatus.AWAITING_PAYMENT,
            price=2000.0,
            payment_deadline=now_manila() + timedelta(hours=24),
        )
        profile = Profile(profile_id=profile_id, client_id=client_id)

        # Mock db queries
        # appointment_repo.get_by_id:
        def db_get(model, ident):
            if model == Appointment:
                return appt
            if model == Profile:
                return profile
            return None

        db.get.side_effect = db_get

        # payment_repo.get_pending:
        mock_exec = MagicMock()
        mock_exec.first.return_value = None
        db.exec.return_value = mock_exec

        uc = PaymentUsecase(db, provider)
        res = uc.initiate_payment(appt_id, client_id)

        assert len(provider.created_checkouts) == 1
        checkout_call = provider.created_checkouts[0]
        assert checkout_call["amount"] == 2000.0
        assert checkout_call["currency"] == "PHP"
        assert checkout_call["reference"] == str(appt_id)
        assert f"/bookings/{appt_id}?payment=success" in checkout_call["success_url"]
        assert f"/bookings/{appt_id}?payment=cancelled" in checkout_call["cancel_url"]

        assert db.add.called
        assert db.commit.called

    def test_initiate_payment_custom_urls(self, db, provider):
        client_id = uuid.uuid4()
        appt_id = uuid.uuid4()
        profile_id = uuid.uuid4()

        appt = Appointment(
            appointment_id=appt_id,
            profile_id=profile_id,
            psychologist_id=uuid.uuid4(),
            status=AppointmentStatus.AWAITING_PAYMENT,
            price=2500.0,
            payment_deadline=now_manila() + timedelta(hours=24),
        )
        profile = Profile(profile_id=profile_id, client_id=client_id)

        def db_get(model, ident):
            if model == Appointment:
                return appt
            if model == Profile:
                return profile
            return None

        db.get.side_effect = db_get
        mock_exec = MagicMock()
        mock_exec.first.return_value = None
        db.exec.return_value = mock_exec

        uc = PaymentUsecase(db, provider)
        uc.initiate_payment(
            appt_id,
            client_id,
            success_url="http://localhost:3000/custom-success",
            cancel_url="http://localhost:3000/custom-cancel",
        )

        checkout_call = provider.created_checkouts[0]
        assert checkout_call["success_url"] == "http://localhost:3000/custom-success"
        assert checkout_call["cancel_url"] == "http://localhost:3000/custom-cancel"

    def test_initiate_payment_rejects_external_redirect_url(self, db, provider):
        client_id = uuid.uuid4()
        appt_id = uuid.uuid4()
        profile_id = uuid.uuid4()

        appt = Appointment(
            appointment_id=appt_id,
            profile_id=profile_id,
            psychologist_id=uuid.uuid4(),
            status=AppointmentStatus.AWAITING_PAYMENT,
            price=2500.0,
            payment_deadline=now_manila() + timedelta(hours=24),
        )
        profile = Profile(profile_id=profile_id, client_id=client_id)

        def db_get(model, ident):
            if model == Appointment:
                return appt
            if model == Profile:
                return profile
            return None

        db.get.side_effect = db_get
        mock_exec = MagicMock()
        mock_exec.first.return_value = None
        db.exec.return_value = mock_exec

        uc = PaymentUsecase(db, provider)
        with pytest.raises(BadRequestError, match="Invalid payment redirect URL"):
            uc.initiate_payment(
                appt_id,
                client_id,
                success_url="https://evil.example/steal",
                cancel_url="http://localhost:3000/custom-cancel",
            )
        assert len(provider.created_checkouts) == 0

    def test_initiate_payment_reuses_existing_pending(self, db, provider):
        client_id = uuid.uuid4()
        appt_id = uuid.uuid4()
        profile_id = uuid.uuid4()

        appt = Appointment(
            appointment_id=appt_id,
            profile_id=profile_id,
            psychologist_id=uuid.uuid4(),
            status=AppointmentStatus.AWAITING_PAYMENT,
            price=2000.0,
            payment_deadline=now_manila() + timedelta(hours=24),
        )
        profile = Profile(profile_id=profile_id, client_id=client_id)
        existing_payment = Payment(
            payment_id=uuid.uuid4(),
            appointment_id=appt_id,
            amount=2000.0,
            provider="paymongo",
            provider_ref="cs_existing_123",
            checkout_url="https://checkout.paymongo.com/cs_existing_123",
            status=PaymentStatus.PENDING,
        )

        def db_get(model, ident):
            if model == Appointment:
                return appt
            if model == Profile:
                return profile
            return None

        db.get.side_effect = db_get

        mock_exec = MagicMock()
        mock_exec.first.return_value = existing_payment
        db.exec.return_value = mock_exec

        uc = PaymentUsecase(db, provider)
        res = uc.initiate_payment(appt_id, client_id)

        assert res == existing_payment
        assert len(provider.created_checkouts) == 0  # No new call made to PayMongo!

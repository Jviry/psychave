import uuid
from datetime import datetime, timezone
from sqlmodel import Session

from common.exceptions import BadRequestError, NotFoundError
from models.appointment import Appointment, AppointmentStatus
from models.payment import Payment, PaymentStatus
from models.persona import Persona
from repo.appointment_repo import AppointmentRepo
from repo.payment_repo import PaymentRepo
from services.payments.base import PaymentProvider


class PaymentUsecase:
    def __init__(self, db: Session, provider: PaymentProvider):
        self.db = db
        self.provider = provider
        self.appointments = AppointmentRepo(db)
        self.payments = PaymentRepo(db)

    def _get_owned_appointment(
        self, appointment_id: uuid.UUID, client_id: uuid.UUID
    ) -> Appointment:
        appt = self.appointments.get_by_id(appointment_id)
        if appt is None:
            raise NotFoundError("Appointment not found")
        persona = self.db.get(Persona, appt.persona_id)
        if persona is None or persona.client_id != client_id:
            raise NotFoundError("Appointment not found")
        return appt

    def initiate_payment(
        self,
        appointment_id: uuid.UUID,
        client_id: uuid.UUID,
        payment_method: str | None = None,
    ) -> Payment:
        appt = self._get_owned_appointment(appointment_id, client_id)
        if appt.status != AppointmentStatus.AWAITING_PAYMENT:
            raise BadRequestError("Appointment is not awaiting payment")
        if appt.price is None:
            raise BadRequestError("Price is not set yet")

        existing = self.payments.get_pending(appointment_id)
        if existing is not None:
            return existing

        initiated = self.provider.create_checkout(
            amount=appt.price,
            currency="PHP",
            reference=str(appointment_id),
            description=f"Appointment {appointment_id}",
        )
        return self.payments.create(
            appointment_id=appointment_id,
            amount=appt.price,
            provider=self.provider.name,
            provider_ref=initiated.provider_ref,
            checkout_url=initiated.checkout_url,
            payment_method=payment_method,
        )

    def handle_webhook(
        self,
        provider_ref: str,
        paid: bool,
        payment_method: str | None = None,
    ) -> Payment:
        payment = self.payments.get_by_provider_ref(provider_ref)
        if payment is None:
            raise NotFoundError("Payment not found")
        if payment.status == PaymentStatus.PAID:
            return payment

        if not paid:
            return self.payments.mark_failed(payment)

        paid_payment = self.payments.mark_paid(
            payment,
            paid_at=datetime.now(timezone.utc),
            payment_method=payment_method,
        )
        appt = self.appointments.get_by_id(payment.appointment_id)
        # Only flip from awaiting-payment; a cancelled appointment stays
        # cancelled even if money arrived (needs manual handling, not auto-confirm).
        if appt is not None and appt.status == AppointmentStatus.AWAITING_PAYMENT:
            appt.status = AppointmentStatus.CONFIRMED
            self.db.add(appt)
            self.db.commit()
            self.db.refresh(appt)
        return paid_payment

    def get_history(
        self, appointment_id: uuid.UUID, client_id: uuid.UUID
    ) -> list[Payment]:
        self._get_owned_appointment(appointment_id, client_id)
        return self.payments.list_for_appointment(appointment_id)

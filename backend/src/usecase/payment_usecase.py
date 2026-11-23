import uuid
from datetime import datetime, timezone
from sqlmodel import Session

from common.exceptions import BadRequestError, NotFoundError
from common.settings import settings
from common.time import now_manila
from models.appointment import Appointment, AppointmentStatus
from models.payment import Payment, PaymentStatus
from dependencies.email import get_email_service
from repo.appointment_repo import AppointmentRepo
from repo.payment_repo import PaymentRepo
from repo.profile_repo import ProfileRepo
from services.email.base import BaseEmailService
from services.payments.base import PaymentProvider


class PaymentUsecase:
    def __init__(
        self,
        db: Session,
        provider: PaymentProvider,
        email_service: BaseEmailService | None = None,
    ):
        self.db = db
        self.provider = provider
        self.appointments = AppointmentRepo(db)
        self.payments = PaymentRepo(db)
        self.profiles = ProfileRepo(db)
        self.email_service = email_service or get_email_service()

    def _get_owned_appointment(
        self, appointment_id: uuid.UUID, client_id: uuid.UUID
    ) -> Appointment:
        appt = self.appointments.get_by_id(appointment_id)
        if appt is None:
            raise NotFoundError("Appointment not found")
        profile = self.profiles.get_by_id(appt.profile_id)
        if profile is None or profile.client_id != client_id:
            raise NotFoundError("Appointment not found")
        return appt

    def initiate_payment(
        self,
        appointment_id: uuid.UUID,
        client_id: uuid.UUID,
        payment_method: str | None = None,
        success_url: str | None = None,
        cancel_url: str | None = None,
    ) -> Payment:
        appt = self._get_owned_appointment(appointment_id, client_id)
        self.appointments.expire_if_overdue(appt)
        if appt.status != AppointmentStatus.AWAITING_PAYMENT:
            raise BadRequestError(
                "Appointment is not awaiting payment. The deadline may have passed; please agree on a new schedule."
            )
        if appt.price is None:
            raise BadRequestError("Price is not set yet")
        if appt.payment_deadline is None:
            raise BadRequestError("Payment deadline is not set")
        deadline = appt.payment_deadline
        if deadline.tzinfo is not None:
            from common.time import MANILA_TZ
            deadline = deadline.astimezone(MANILA_TZ).replace(tzinfo=None)
        if deadline <= now_manila():
            raise BadRequestError("Payment deadline has passed")

        existing = self.payments.get_pending(appointment_id)
        if existing is not None:
            reconciled = self.reconcile_pending_payment(appointment_id)
            if reconciled is not None:
                if reconciled.status == PaymentStatus.PAID:
                    return reconciled
                # If the previous checkout expired/failed on the gateway, fall through
                # and create a fresh checkout session.
            else:
                return existing

        base_fe = settings.FRONTEND_URL.rstrip("/")
        final_success_url = (
            success_url or f"{
                base_fe}/proposal/{appointment_id}?payment=success"
        )
        final_cancel_url = (
            cancel_url or f"{
                base_fe}/proposal/{appointment_id}?payment=cancelled"
        )

        initiated = self.provider.create_checkout(
            amount=appt.price,
            currency="PHP",
            reference=str(appointment_id),
            description=f"Appointment {appointment_id}",
            success_url=final_success_url,
            cancel_url=final_cancel_url,
        )
        payment = self.payments.create(
            appointment_id=appointment_id,
            amount=appt.price,
            provider=self.provider.name,
            provider_ref=initiated.provider_ref,
            checkout_url=initiated.checkout_url,
            payment_method=payment_method,
        )
        return payment

    def reconcile_pending_payment(
        self, appointment_id: uuid.UUID
    ) -> Payment | None:
        """Check the payment gateway for a pending checkout's status and apply it.

        Returns the updated Payment if the gateway reported a terminal state
        (paid or failed/expired), otherwise None.
        """
        existing = self.payments.get_pending(appointment_id)
        if existing is None or not existing.provider_ref:
            return None

        fetch_status = getattr(self.provider, "fetch_checkout_status", None)
        if not callable(fetch_status):
            return None

        event = fetch_status(existing.provider_ref)
        if event is None:
            return None

        return self.handle_webhook(
            provider_ref=event.provider_ref or existing.provider_ref,
            paid=event.paid,
            payment_method=event.payment_method,
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

        appt = self.appointments.get_by_id(payment.appointment_id)
        if appt is not None and self.appointments.expire_if_overdue(appt):
            self.db.refresh(payment)

        was_pending = payment.status == PaymentStatus.PENDING
        paid_payment = self.payments.mark_paid(
            payment,
            paid_at=datetime.now(timezone.utc),
            payment_method=payment_method,
        )
        # Only auto-confirm an active pending checkout whose appointment is still
        # awaiting payment; cancelled or deadline-expired checkouts keep the paid
        # ledger entry for manual reconciliation without double-booking.
        if (
            was_pending
            and appt is not None
            and appt.status == AppointmentStatus.AWAITING_PAYMENT
        ):
            self.appointments.confirm(appt)
            client_email = self.appointments.get_client_email(appt)
            if client_email:
                self.email_service.send_payment_confirmed(
                    client_email,
                    str(appt.appointment_id),
                    "client",
                )
            psych_email = self.appointments.get_psychologist_email(appt)
            if psych_email:
                self.email_service.send_payment_confirmed(
                    psych_email,
                    str(appt.appointment_id),
                    "psychologist",
                )
        return paid_payment

    def get_history(
        self, appointment_id: uuid.UUID, client_id: uuid.UUID
    ) -> list[Payment]:
        appt = self._get_owned_appointment(appointment_id, client_id)
        self.appointments.expire_if_overdue(appt)
        return self.payments.list_for_appointment(appointment_id)

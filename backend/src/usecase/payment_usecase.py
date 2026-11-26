import logging
import uuid
from datetime import datetime, timezone
from urllib.parse import urlparse
from sqlmodel import Session

from common.exceptions import BadRequestError, NotFoundError
from common.settings import settings
from common.time import now_manila
from models.appointment import Appointment, AppointmentStatus, SchedulingTurn
from models.payment import Payment, PaymentStatus, PaymentType
from dependencies.email import get_email_service
from repo.appointment_repo import AppointmentRepo
from repo.payment_repo import PaymentRepo
from repo.profile_repo import ProfileRepo
from services.email.base import BaseEmailService
from services.payments.base import PaymentProvider

logger = logging.getLogger("uvicorn.error")

RESCHEDULE_FEE_PHP = 600.0


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
            if existing.payment_type != PaymentType.SESSION:
                self.payments.mark_failed(existing)
            else:
                reconciled = self.reconcile_pending_payment(appointment_id)
                if reconciled is not None:
                    if reconciled.status == PaymentStatus.PAID:
                        return reconciled
                    # If the previous checkout expired/failed on the gateway, fall through
                    # and create a fresh checkout session.
                else:
                    return existing

        base_fe = settings.FRONTEND_URL.rstrip("/")
        default_success = f"{base_fe}/proposal/{appointment_id}?payment=success"
        default_cancel = f"{base_fe}/proposal/{appointment_id}?payment=cancelled"
        final_success_url = self._validate_redirect_url(success_url, default_success)
        final_cancel_url = self._validate_redirect_url(cancel_url, default_cancel)

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
            payment_type=PaymentType.SESSION,
        )
        return payment

    def initiate_reschedule_fee_payment(
        self,
        appointment_id: uuid.UUID,
        client_id: uuid.UUID,
        payment_method: str | None = None,
        success_url: str | None = None,
        cancel_url: str | None = None,
    ) -> Payment:
        appt = self._get_owned_appointment(appointment_id, client_id)
        if appt.status not in (
            AppointmentStatus.RESCHEDULE_REQUESTED,
            AppointmentStatus.NO_SHOW,
        ):
            raise BadRequestError(
                "Appointment does not require a reschedule fee"
            )
        if appt.reschedule_fee_waived:
            raise BadRequestError("Reschedule fee has already been waived")

        existing = self.payments.get_pending(appointment_id)
        if existing is not None:
            if existing.payment_type != PaymentType.RESCHEDULE_FEE:
                self.payments.mark_failed(existing)
            else:
                reconciled = self.reconcile_pending_payment(appointment_id)
                if reconciled is not None:
                    if reconciled.status == PaymentStatus.PAID:
                        return reconciled
                else:
                    return existing

        base_fe = settings.FRONTEND_URL.rstrip("/")
        default_success = f"{base_fe}/proposal/{appointment_id}?payment=success"
        default_cancel = f"{base_fe}/proposal/{appointment_id}?payment=cancelled"
        final_success_url = self._validate_redirect_url(success_url, default_success)
        final_cancel_url = self._validate_redirect_url(cancel_url, default_cancel)

        initiated = self.provider.create_checkout(
            amount=RESCHEDULE_FEE_PHP,
            currency="PHP",
            reference=f"{appointment_id}:reschedule",
            description=f"Reschedule fee for appointment {appointment_id}",
            success_url=final_success_url,
            cancel_url=final_cancel_url,
        )
        return self.payments.create(
            appointment_id=appointment_id,
            amount=RESCHEDULE_FEE_PHP,
            provider=self.provider.name,
            provider_ref=initiated.provider_ref,
            checkout_url=initiated.checkout_url,
            payment_method=payment_method,
            payment_type=PaymentType.RESCHEDULE_FEE,
        )

    @staticmethod
    def _validate_redirect_url(url: str | None, fallback: str) -> str:
        """Ensure redirect URLs stay on the configured FRONTEND_URL origin."""
        if not url:
            return fallback
        parsed = urlparse(url)
        allowed = urlparse(settings.FRONTEND_URL)
        if (
            parsed.scheme not in ("http", "https")
            or not parsed.netloc
            or parsed.netloc != allowed.netloc
            or parsed.scheme != allowed.scheme
        ):
            raise BadRequestError("Invalid payment redirect URL")
        return url

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
            gateway_payment_id=event.gateway_payment_id,
            event_type=event.event_type,
        )

    def handle_webhook(
        self,
        provider_ref: str,
        paid: bool,
        payment_method: str | None = None,
        gateway_payment_id: str | None = None,
        event_type: str | None = None,
        refund_id: str | None = None,
        refund_amount_centavos: int | None = None,
        refund_status: str | None = None,
    ) -> Payment:
        if event_type in ("payment.refunded", "payment.refund.updated"):
            payment = (
                (self.payments.get_by_gateway_payment_id(gateway_payment_id) if gateway_payment_id else None)
                or self.payments.get_by_gateway_payment_id(provider_ref)
                or self.payments.get_by_provider_ref(provider_ref)
            )
            if payment is None:
                raise NotFoundError("Payment not found")
            if refund_status == "failed":
                logger.warning(
                    "Ignoring failed refund webhook for payment %s (refund_id=%s)",
                    payment.payment_id,
                    refund_id,
                )
                return payment
            paid_centavos = int(round(payment.amount * 100))
            effective_refund_centavos = (
                refund_amount_centavos
                if refund_amount_centavos is not None
                else (payment.refund_amount_centavos or paid_centavos)
            )
            is_full = effective_refund_centavos >= paid_centavos
            now = datetime.now(timezone.utc)
            updated_payment = self.payments.mark_refunded(
                payment,
                status=PaymentStatus.REFUNDED if is_full else PaymentStatus.PARTIALLY_REFUNDED,
                refund_amount_centavos=effective_refund_centavos,
                refund_ref=refund_id,
                refund_reason=payment.refund_reason,
                refunded_at=now,
            )
            appt = self.appointments.get_by_id(payment.appointment_id)
            if appt is not None:
                appt.status = (
                    AppointmentStatus.REFUNDED
                    if is_full
                    else AppointmentStatus.PARTIALLY_REFUNDED
                )
                appt.refund_amount_centavos = effective_refund_centavos
                appt.refunded_at = now
                self.db.add(appt)
                self.db.commit()
            return updated_payment

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
            gateway_payment_id=gateway_payment_id,
        )
        if was_pending and appt is not None:
            if (
                payment.payment_type == PaymentType.RESCHEDULE_FEE
                and appt.status
                in (AppointmentStatus.RESCHEDULE_REQUESTED, AppointmentStatus.NO_SHOW)
            ):
                self.appointments.start_reschedule_negotiation(
                    appt, turn=SchedulingTurn.CLIENT
                )
            elif (
                payment.payment_type == PaymentType.SESSION
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

import uuid
from datetime import datetime
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select
from models.payment import Payment, PaymentStatus, PaymentType


class PaymentRepo:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        appointment_id: uuid.UUID,
        amount: float,
        provider: str,
        provider_ref: str | None,
        checkout_url: str | None,
        payment_method: str | None = None,
        payment_type: PaymentType = PaymentType.SESSION,
    ) -> Payment:
        payment = Payment(
            appointment_id=appointment_id,
            amount=amount,
            payment_type=payment_type,
            provider=provider,
            provider_ref=provider_ref,
            checkout_url=checkout_url,
            payment_method=payment_method,
            status=PaymentStatus.PENDING,
        )
        self.db.add(payment)
        try:
            self.db.commit()
        except IntegrityError:
            self.db.rollback()
            existing = self.get_pending(appointment_id)
            if existing is not None:
                return existing
            raise
        self.db.refresh(payment)
        return payment

    def get_pending(self, appointment_id: uuid.UUID) -> Payment | None:
        return self.db.exec(
            select(Payment)
            .where(
                Payment.appointment_id == appointment_id,
                Payment.status == PaymentStatus.PENDING,
            )
            .order_by(Payment.created_at.desc())
        ).first()

    def list_for_appointment(self, appointment_id: uuid.UUID) -> list[Payment]:
        return self.db.exec(
            select(Payment)
            .where(Payment.appointment_id == appointment_id)
            .order_by(Payment.created_at.desc())
        ).all()

    def get_by_provider_ref(self, provider_ref: str) -> Payment | None:
        return self.db.exec(
            select(Payment).where(Payment.provider_ref == provider_ref)
        ).first()

    def get_by_gateway_payment_id(self, gateway_payment_id: str) -> Payment | None:
        return self.db.exec(
            select(Payment).where(Payment.gateway_payment_id == gateway_payment_id)
        ).first()

    def get_paid_session(self, appointment_id: uuid.UUID) -> Payment | None:
        return self.db.exec(
            select(Payment)
            .where(
                Payment.appointment_id == appointment_id,
                Payment.payment_type == PaymentType.SESSION,
                Payment.status.in_(
                    [PaymentStatus.PAID, PaymentStatus.PARTIALLY_REFUNDED]
                ),
            )
            .order_by(Payment.created_at.desc())
        ).first()

    def has_paid_session(self, appointment_id: uuid.UUID) -> bool:
        return self.get_paid_session(appointment_id) is not None

    def mark_paid(
        self,
        payment: Payment,
        paid_at: datetime,
        payment_method: str | None = None,
        gateway_payment_id: str | None = None,
    ) -> Payment:
        payment.status = PaymentStatus.PAID
        payment.paid_at = paid_at
        if payment_method is not None:
            payment.payment_method = payment_method
        if gateway_payment_id is not None:
            payment.gateway_payment_id = gateway_payment_id
        self.db.add(payment)
        self.db.commit()
        self.db.refresh(payment)
        return payment

    def mark_refunded(
        self,
        payment: Payment,
        *,
        status: PaymentStatus,
        refund_amount_centavos: int,
        refund_ref: str | None,
        refund_reason: str | None,
        refunded_at: datetime,
    ) -> Payment:
        payment.status = status
        payment.refund_amount_centavos = refund_amount_centavos
        if refund_ref is not None:
            payment.refund_ref = refund_ref
        if refund_reason is not None:
            payment.refund_reason = refund_reason
        payment.refunded_at = refunded_at
        self.db.add(payment)
        self.db.commit()
        self.db.refresh(payment)
        return payment

    def mark_failed(self, payment: Payment) -> Payment:
        payment.status = PaymentStatus.FAILED
        self.db.add(payment)
        self.db.commit()
        self.db.refresh(payment)
        return payment

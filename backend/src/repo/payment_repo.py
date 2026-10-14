import uuid
from datetime import datetime
from sqlmodel import Session, select
from models.payment import Payment, PaymentStatus


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
    ) -> Payment:
        payment = Payment(
            appointment_id=appointment_id,
            amount=amount,
            provider=provider,
            provider_ref=provider_ref,
            checkout_url=checkout_url,
            payment_method=payment_method,
            status=PaymentStatus.PENDING,
        )
        self.db.add(payment)
        self.db.commit()
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

    def mark_paid(
        self, payment: Payment, paid_at: datetime, payment_method: str | None = None
    ) -> Payment:
        payment.status = PaymentStatus.PAID
        payment.paid_at = paid_at
        if payment_method is not None:
            payment.payment_method = payment_method
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

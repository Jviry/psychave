from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session

from common.database import get_db
from dependencies.payments import get_payment_provider
from schemas.payment import PaymentRead
from interfaces.payment import PaymentProvider
from usecase.payment_usecase import PaymentUsecase

router = APIRouter()


@router.post("/webhook")
async def payment_webhook(
    request: Request,
    db: Session = Depends(get_db),
    provider: PaymentProvider = Depends(get_payment_provider),
):
    raw_body = await request.body()
    if not provider.verify_signature(raw_body, request.headers):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    event = provider.parse_webhook(raw_body, request.headers)
    if event is None:
        return {"status": "ignored"}

    uc = PaymentUsecase(db, provider)
    payment = uc.handle_webhook(
        provider_ref=event.provider_ref,
        paid=event.paid,
        payment_method=event.payment_method,
    )
    return PaymentRead.model_validate(payment)

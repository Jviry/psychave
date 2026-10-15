from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session

from common.database import get_db
from dependencies.payments import get_payment_provider
from services.payments.base import PaymentProvider
from schemas.payment import PaymentRead, PaymentWebhookRequest
from usecase.payment_usecase import PaymentUsecase

router = APIRouter()


@router.post("/webhook", response_model=PaymentRead)
async def payment_webhook(
    request: Request,
    db: Session = Depends(get_db),
    provider: PaymentProvider = Depends(get_payment_provider),
):
    raw_body = await request.body()
    if not provider.verify_signature(raw_body, request.headers):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    payload = PaymentWebhookRequest.model_validate(await request.json())
    uc = PaymentUsecase(db, provider)
    return uc.handle_webhook(
        provider_ref=payload.provider_ref,
        paid=payload.outcome == "paid",
        payment_method=payload.payment_method,
    )

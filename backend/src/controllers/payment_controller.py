from fastapi import APIRouter, HTTPException, Request

from dependencies.auth import DbDep
from dependencies.payments import PaymentProviderDep
from schemas.payment import PaymentRead
from usecase.payment_usecase import PaymentUsecase

router = APIRouter()


@router.post("/webhook")
async def payment_webhook(
    request: Request,
    db: DbDep,
    provider: PaymentProviderDep,
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

"""Payment endpoints via Stripe."""
from fastapi import APIRouter, HTTPException, Request
from app.api.schemas import CreatePaymentBody, PaymentResponse
from app.services import stripe_service
from app.utils.logger import get_logger

router = APIRouter(prefix="/payments", tags=["Payments"])
logger = get_logger(__name__)


@router.post(
    "/create-intent",
    response_model=PaymentResponse,
    status_code=201,
    summary="Create a Stripe PaymentIntent",
)
async def create_payment_intent(body: CreatePaymentBody):
    """Create a Stripe PaymentIntent for a completed ride."""
    try:
        intent = await stripe_service.create_payment_intent(
            amount_usd=body.amount_usd,
            currency=body.currency,
            metadata={"ride_id": str(body.ride_id)},
        )
        return PaymentResponse(
            payment_intent_id=intent["id"],
            client_secret=intent.get("client_secret"),
            status=intent.get("status", "created"),
            amount_usd=body.amount_usd,
            mock=intent.get("mock", False),
        )
    except Exception as exc:
        logger.error("payment.create_failed", error=str(exc))
        raise HTTPException(status_code=502, detail=f"Payment service error: {exc}")


@router.post(
    "/webhook",
    summary="Stripe webhook receiver",
    include_in_schema=False,
)
async def stripe_webhook(request: Request):
    """Receive and validate Stripe webhook events."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    try:
        event = stripe_service.verify_webhook_signature(payload, sig_header)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    event_type = event.get("type", "")
    logger.info("stripe.webhook_received", event_type=event_type)

    if event_type == "payment_intent.succeeded":
        data = event["data"]["object"]
        ride_id = data.get("metadata", {}).get("ride_id")
        logger.info("payment.succeeded", ride_id=ride_id, amount=data.get("amount"))

    return {"received": True}

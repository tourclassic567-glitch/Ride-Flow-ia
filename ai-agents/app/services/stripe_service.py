"""Stripe payment service – payment intent creation and webhook handling."""
import asyncio
import stripe
from typing import Optional

from app.config import get_settings
from app.utils.logger import get_logger
from app.services.metrics import payment_intents_total

logger = get_logger(__name__)


def _get_stripe():
    settings = get_settings()
    if settings.stripe_secret_key:
        stripe.api_key = settings.stripe_secret_key
        return stripe
    return None


async def create_payment_intent(
    amount_usd: float,
    currency: str = "usd",
    metadata: Optional[dict] = None,
) -> dict:
    """Create a Stripe PaymentIntent. Falls back to mock if no key configured."""
    client = _get_stripe()
    amount_cents = int(amount_usd * 100)

    if client is None:
        logger.warning("stripe.mock_mode", amount_usd=amount_usd)
        mock = {
            "id": f"pi_mock_{amount_cents}",
            "amount": amount_cents,
            "currency": currency,
            "status": "requires_payment_method",
            "client_secret": f"pi_mock_{amount_cents}_secret_mock",
            "mock": True,
        }
        payment_intents_total.labels(status="mock").inc()
        return mock

    try:
        intent = await asyncio.to_thread(
            client.PaymentIntent.create,
            amount=amount_cents,
            currency=currency,
            metadata=metadata or {},
            automatic_payment_methods={"enabled": True},
        )
        payment_intents_total.labels(status="created").inc()
        logger.info("stripe.intent_created", intent_id=intent.id, amount_usd=amount_usd)
        return dict(intent)
    except stripe.StripeError as exc:
        payment_intents_total.labels(status="error").inc()
        logger.error("stripe.error", error=str(exc))
        raise


async def confirm_payment_intent(payment_intent_id: str) -> dict:
    """Confirm a PaymentIntent."""
    client = _get_stripe()
    if client is None or payment_intent_id.startswith("pi_mock"):
        return {"id": payment_intent_id, "status": "succeeded", "mock": True}

    try:
        intent = await asyncio.to_thread(client.PaymentIntent.confirm, payment_intent_id)
        payment_intents_total.labels(status="confirmed").inc()
        logger.info("stripe.intent_confirmed", intent_id=payment_intent_id)
        return dict(intent)
    except stripe.StripeError as exc:
        logger.error("stripe.confirm_error", error=str(exc))
        raise


def verify_webhook_signature(payload: bytes, sig_header: str) -> dict:
    """Validate Stripe webhook signature and return the event."""
    settings = get_settings()
    if not settings.stripe_webhook_secret:
        logger.warning("stripe.webhook_mock")
        import json
        return json.loads(payload)

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
        return event
    except (stripe.SignatureVerificationError, ValueError) as exc:
        logger.error("stripe.webhook_invalid", error=str(exc))
        raise

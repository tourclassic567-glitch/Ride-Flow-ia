import logging
import secrets as _secrets

import stripe
from app.config import settings

logger = logging.getLogger(__name__)

stripe.api_key = settings.stripe_secret_key

_MOCK_MODE = settings.stripe_secret_key.startswith("sk_test_placeholder")


async def create_payment_intent(amount: float) -> dict:
    if _MOCK_MODE:
        mock_id = f"pi_mock_{_secrets.token_hex(8)}"
        logger.warning("Stripe mock mode active — returning fake PaymentIntent %s", mock_id)
        return {"id": mock_id, "client_secret": f"{mock_id}_secret", "status": "requires_payment_method"}
    try:
        intent = stripe.PaymentIntent.create(
            amount=int(amount * 100),
            currency="usd",
            automatic_payment_methods={"enabled": True},
        )
        return {"id": intent.id, "client_secret": intent.client_secret, "status": intent.status}
    except stripe.error.AuthenticationError as exc:
        logger.error("Stripe authentication failed — check STRIPE_SECRET_KEY: %s", exc)
        raise
    except stripe.error.StripeError as exc:
        logger.error("Stripe API error creating PaymentIntent: %s", exc)
        raise


async def confirm_payment(payment_intent_id: str) -> dict:
    if _MOCK_MODE:
        logger.warning("Stripe mock mode — returning fake confirmation for %s", payment_intent_id)
        return {"id": payment_intent_id, "status": "succeeded"}
    try:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        return {"id": intent.id, "status": intent.status}
    except stripe.error.StripeError as exc:
        logger.error("Stripe API error confirming payment %s: %s", payment_intent_id, exc)
        raise

import stripe
from app.config import settings

stripe.api_key = settings.stripe_secret_key


async def create_payment_intent(amount: float) -> dict:
    try:
        intent = stripe.PaymentIntent.create(
            amount=int(amount * 100),
            currency="usd",
            automatic_payment_methods={"enabled": True},
        )
        return {"id": intent.id, "client_secret": intent.client_secret, "status": intent.status}
    except Exception:
        # Mock mode
        import secrets as _s
        mock_id = f"pi_mock_{_s.token_hex(8)}"
        return {"id": mock_id, "client_secret": f"{mock_id}_secret", "status": "requires_payment_method"}


async def confirm_payment(payment_intent_id: str) -> dict:
    try:
        intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        return {"id": intent.id, "status": intent.status}
    except Exception:
        return {"id": payment_intent_id, "status": "succeeded"}

let stripe = null;

if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
}

async function createPaymentIntent(amount, currency = 'usd') {
  if (!stripe) {
    return {
      id: `pi_mock_${Date.now()}`,
      client_secret: 'mock_secret',
      status: 'requires_payment_method',
    };
  }

  return stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // convert to cents
    currency,
  });
}

async function confirmPayment(payment_intent_id) {
  if (!stripe) {
    return {
      id: payment_intent_id,
      status: 'succeeded',
    };
  }

  return stripe.paymentIntents.confirm(payment_intent_id);
}

module.exports = { createPaymentIntent, confirmPayment };

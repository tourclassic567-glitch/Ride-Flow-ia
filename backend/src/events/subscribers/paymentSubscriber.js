'use strict';

/**
 * Payment subscriber – reacts to payment-lifecycle events on the eventBus
 * and triggers the Stripe service.
 *
 * Responsibilities:
 *   PAYMENT_REQUESTED → call Stripe → emit PAYMENT_COMPLETED
 */

const eventBus = require('../eventBus');
const eventTypes = require('../eventTypes');
const { createPaymentIntent } = require('../../services/stripeService');
const db = require('../../db');

function register() {
  eventBus.subscribe(eventTypes.PAYMENT_REQUESTED, handlePaymentRequested);
  console.log('[paymentSubscriber] Registered for PAYMENT_REQUESTED');
}

/**
 * Reacts to a payment being requested.
 * Creates the Stripe payment intent (the ONLY place where stripe is called
 * for intent creation), persists the record, and emits PAYMENT_COMPLETED.
 */
async function handlePaymentRequested(payload) {
  const { ride_id, amount } = payload;

  try {
    const paymentIntent = await createPaymentIntent(amount);

    // Persist payment record (graceful – mock mode if DB unavailable)
    await db.query(
      `INSERT INTO payments (ride_id, amount, stripe_payment_id, status)
       VALUES ($1, $2, $3, 'pending')`,
      [ride_id, amount, paymentIntent.id]
    );

    eventBus.publish(eventTypes.PAYMENT_COMPLETED, {
      ride_id,
      payment_id: paymentIntent.id,
      client_secret: paymentIntent.client_secret,
      status: paymentIntent.status,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[paymentSubscriber] handlePaymentRequested error:', err.message);
    eventBus.publish(eventTypes.FLOW_FAILED, {
      source: 'paymentSubscriber.handlePaymentRequested',
      error: err.message,
      payload,
    });
  }
}

module.exports = { register };

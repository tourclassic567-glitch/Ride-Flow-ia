'use strict';

/**
 * Flow engine – registry of all named flows.
 *
 * Each flow is an async function that:
 *   1. Performs its own work (DB reads/writes, calculations).
 *   2. Emits events via the eventBus for side-effects and decoupled
 *      inter-service communication — it does NOT call services directly.
 *
 * Flows are executed exclusively by the executor (never called directly).
 */

const flows = new Map();
const eventBus = require('../events/eventBus');
const eventTypes = require('../events/eventTypes');
const db = require('../db');

function register(name, handler) {
  flows.set(name, handler);
}

async function run(name, context) {
  const handler = flows.get(name);
  if (!handler) {
    throw new Error(`Flow not found: ${name}`);
  }
  return handler(context);
}

// ---------------------------------------------------------------------------
// ride-request-flow
// Persists the ride record, then emits RIDE_REQUESTED for subscribers.
// ---------------------------------------------------------------------------
register('ride-request-flow', async (ctx) => {
  const { passenger_id, pickup_location, dropoff_location, estimated_price } = ctx;

  const result = await db.query(
    `INSERT INTO rides (passenger_id, pickup_location, dropoff_location, price, status)
     VALUES ($1, $2, $3, $4, 'requested')
     RETURNING id, status, pickup_location, dropoff_location, price, created_at`,
    [passenger_id, pickup_location, dropoff_location, estimated_price]
  );

  const ride = result
    ? result.rows[0]
    : {
        id: Date.now(),
        status: 'requested',
        pickup_location,
        dropoff_location,
        price: estimated_price,
        created_at: new Date().toISOString(),
      };

  // Emit event – subscribers react (notifications, analytics, etc.)
  eventBus.publish(eventTypes.RIDE_REQUESTED, { ...ctx, ride_id: ride.id, ride });

  return { ...ctx, ride };
});

// ---------------------------------------------------------------------------
// ride-match-flow
// Emits DRIVER_MATCH_REQUESTED and awaits DRIVER_ASSIGNED via request-reply.
// The rideSubscriber calls findNearestDriver and emits DRIVER_ASSIGNED.
// ---------------------------------------------------------------------------
register('ride-match-flow', async (ctx) => {
  const TIMEOUT_MS = 5000;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      eventBus.unsubscribe(eventTypes.DRIVER_ASSIGNED, onDriverAssigned);
      reject(new Error('Driver assignment timed out after 5000 ms'));
    }, TIMEOUT_MS);

    function onDriverAssigned(payload) {
      // Match on ride_id to avoid picking up unrelated events
      if (String(payload.ride_id) === String(ctx.ride_id)) {
        clearTimeout(timer);
        eventBus.unsubscribe(eventTypes.DRIVER_ASSIGNED, onDriverAssigned);
        resolve(payload);
      }
    }

    eventBus.subscribe(eventTypes.DRIVER_ASSIGNED, onDriverAssigned);

    // Emit the request – rideSubscriber will process and emit the reply
    eventBus.publish(eventTypes.DRIVER_MATCH_REQUESTED, ctx);
  });
});

// ---------------------------------------------------------------------------
// ride-pricing-flow
// Calculates pricing and emits an event for any interested subscribers.
// ---------------------------------------------------------------------------
register('ride-pricing-flow', async (ctx) => {
  const base_fare = 2.50;
  const price_per_mile = 1.50;
  const estimated_distance = parseFloat((Math.random() * 18 + 2).toFixed(2));
  const surge_multiplier = parseFloat((Math.random() * 1.0 + 1.0).toFixed(2));
  const final_price = parseFloat(
    ((base_fare + estimated_distance * price_per_mile) * surge_multiplier).toFixed(2)
  );

  const result = { ...ctx, base_fare, estimated_distance, price_per_mile, surge_multiplier, final_price };

  eventBus.publish(eventTypes.RIDE_PRICING_CALCULATED, result);

  return result;
});

// ---------------------------------------------------------------------------
// ride-status-flow
// Updates ride status and emits a status-change notification.
// ---------------------------------------------------------------------------
register('ride-status-flow', async (ctx) => {
  const { ride_id, status } = ctx;

  await db.query(
    `UPDATE rides SET status = $1 WHERE id = $2`,
    [status, ride_id]
  );

  eventBus.publish(eventTypes.RIDE_STATUS_CHANGED, { ride_id, status });

  return ctx;
});

module.exports = { flows, register, run };

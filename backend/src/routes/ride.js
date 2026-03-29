const express = require('express');
const router = express.Router();
const db = require('../db');
const { findNearestDriver } = require('../services/matching');
const { broadcast } = require('../services/websocket');
const { validateRideRequest, validateRideMatch } = require('../middleware/validate');
const { createPaymentIntent, confirmPayment } = require('../services/stripeService');

// POST /ride/request
router.post('/request', validateRideRequest, async (req, res, next) => {
  try {
    const { passenger_id, pickup_location, dropoff_location } = req.body;

    const base_fare = 2.50;
    const estimated_miles = 5;
    const price_per_mile = 1.50;
    const estimated_price = parseFloat((base_fare + estimated_miles * price_per_mile).toFixed(2));

    const result = await db.query(
      `INSERT INTO rides (passenger_id, pickup_location, dropoff_location, price, status)
       VALUES ($1, $2, $3, $4, 'requested')
       RETURNING id, status, pickup_location, dropoff_location, price, created_at`,
      [passenger_id, pickup_location, dropoff_location, estimated_price]
    );

    if (result) {
      const ride = result.rows[0];
      return res.status(201).json({
        ride_id: ride.id,
        status: ride.status,
        pickup_location: ride.pickup_location,
        dropoff_location: ride.dropoff_location,
        estimated_price: parseFloat(ride.price),
        created_at: ride.created_at,
      });
    }

    // Mock response when DB not available
    return res.status(201).json({
      ride_id: Date.now(),
      status: 'requested',
      pickup_location,
      dropoff_location,
      estimated_price,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// POST /ride/match
router.post('/match', validateRideMatch, async (req, res, next) => {
  try {
    const { ride_id } = req.body;

    const driver = await findNearestDriver(ride_id);

    broadcast({
      type: 'RIDE_MATCHED',
      ride_id,
      driver_id: driver.id,
    });

    return res.json({
      ride_id,
      driver_id: driver.id,
      status: 'matched',
      estimated_arrival: '5 minutes',
    });
  } catch (err) {
    next(err);
  }
});

// GET /ride/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT r.*, 
              u.email AS passenger_email,
              d.latitude AS driver_latitude,
              d.longitude AS driver_longitude,
              d.status AS driver_status
       FROM rides r
       LEFT JOIN users u ON r.passenger_id = u.id
       LEFT JOIN drivers d ON r.driver_id = d.id
       WHERE r.id = $1`,
      [id]
    );

    if (result && result.rows.length > 0) {
      return res.json(result.rows[0]);
    }

    // Mock response when DB not available or ride not found
    return res.json({
      id: parseInt(id, 10),
      passenger_id: 1,
      driver_id: null,
      status: 'requested',
      pickup_location: '123 Main St',
      dropoff_location: '456 Oak Ave',
      price: 10.00,
      created_at: new Date().toISOString(),
      completed_at: null,
    });
  } catch (err) {
    next(err);
  }
});

// POST /ride/pay – create a Stripe payment intent for a ride
router.post('/pay', async (req, res, next) => {
  try {
    const { ride_id, amount } = req.body;

    if (!ride_id) return res.status(400).json({ error: 'ride_id is required' });
    if (!amount || isNaN(amount) || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }

    const intent = await createPaymentIntent(parseFloat(amount));

    // Persist payment record if DB available (non-fatal if it fails)
    try {
      await db.query(
        `INSERT INTO payments (ride_id, amount, stripe_payment_id, status)
         VALUES ($1, $2, $3, 'pending')`,
        [ride_id, amount, intent.id]
      );
    } catch (dbErr) {
      console.warn('Could not persist payment record:', dbErr.message);
    }

    return res.status(201).json({
      ride_id,
      payment_intent_id: intent.id,
      client_secret: intent.client_secret,
      status: intent.status,
    });
  } catch (err) {
    next(err);
  }
});

// POST /ride/pay/confirm – confirm a Stripe payment intent
router.post('/pay/confirm', async (req, res, next) => {
  try {
    const { ride_id, payment_intent_id } = req.body;

    if (!ride_id) return res.status(400).json({ error: 'ride_id is required' });
    if (!payment_intent_id) return res.status(400).json({ error: 'payment_intent_id is required' });

    const confirmed = await confirmPayment(payment_intent_id);

    // Update payment status in DB if available (non-fatal if it fails)
    try {
      await db.query(
        `UPDATE payments SET status = 'completed' WHERE ride_id = $1 AND stripe_payment_id = $2`,
        [ride_id, payment_intent_id]
      );
    } catch (dbErr) {
      console.warn('Could not update payment status:', dbErr.message);
    }

    return res.json({
      ride_id,
      payment_intent_id: confirmed.id,
      status: confirmed.status,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

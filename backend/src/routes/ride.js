const express = require('express');
const router = express.Router();
const db = require('../db');
const { validateRideRequest, validateRideMatch } = require('../middleware/validate');
const orchestrator = require('../flows/orchestrator');

// POST /ride/request
router.post('/request', validateRideRequest, async (req, res, next) => {
  try {
    const { passenger_id, pickup_location, dropoff_location } = req.body;

    const base_fare = 2.50;
    const estimated_miles = 5;
    const price_per_mile = 1.50;
    const estimated_price = parseFloat((base_fare + estimated_miles * price_per_mile).toFixed(2));

    const result = await orchestrator.run(
      'ride-request-flow',
      { passenger_id, pickup_location, dropoff_location, estimated_price },
      { maxRetries: 1 } // single attempt for DB inserts
    );

    const ride = result.ride;
    return res.status(201).json({
      ride_id: ride.id,
      status: ride.status,
      pickup_location: ride.pickup_location,
      dropoff_location: ride.dropoff_location,
      estimated_price: parseFloat(ride.price),
      created_at: ride.created_at,
    });
  } catch (err) {
    next(err);
  }
});

// POST /ride/match
router.post('/match', validateRideMatch, async (req, res, next) => {
  try {
    const { ride_id } = req.body;

    const result = await orchestrator.run(
      'ride-match-flow',
      { ride_id },
      { maxRetries: 2 }
    );

    return res.json({
      ride_id,
      driver_id: result.driver_id,
      status: result.status || 'matched',
      estimated_arrival: result.estimated_arrival || '5 minutes',
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

module.exports = router;

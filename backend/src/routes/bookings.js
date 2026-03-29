const express = require('express');
const router = express.Router();
const db = require('../db');

// POST /bookings - Create a new booking
router.post('/', async (req, res, next) => {
  try {
    const { passenger_id, pickup_location, dropoff_location } = req.body;

    if (!passenger_id || !pickup_location || !dropoff_location) {
      return res.status(400).json({ error: 'passenger_id, pickup_location, and dropoff_location are required' });
    }

    const result = await db.query(
      `INSERT INTO rides (passenger_id, pickup_location, dropoff_location, status)
       VALUES ($1, $2, $3, 'requested')
       RETURNING id, passenger_id, pickup_location, dropoff_location, status, created_at`,
      [passenger_id, pickup_location, dropoff_location]
    );

    if (result && result.rows.length > 0) {
      return res.status(201).json({ message: 'Booking created', booking: result.rows[0] });
    }

    // Mock mode
    return res.status(201).json({
      message: 'Booking created',
      booking: { id: Date.now(), passenger_id, pickup_location, dropoff_location, status: 'requested' },
    });
  } catch (err) {
    next(err);
  }
});

// PUT /bookings/:id/accept - Accept a booking
router.put('/:id/accept', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { driver_id } = req.body;

    const result = await db.query(
      `UPDATE rides SET status = 'matched', driver_id = $1 WHERE id = $2 RETURNING id, status`,
      [driver_id || null, id]
    );

    if (result && result.rows.length > 0) {
      return res.json({ message: `Booking ${id} accepted`, booking: result.rows[0] });
    }

    return res.json({ message: `Booking ${id} accepted` });
  } catch (err) {
    next(err);
  }
});

// PUT /bookings/:id/reject - Reject a booking
router.put('/:id/reject', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `UPDATE rides SET status = 'cancelled' WHERE id = $1 RETURNING id, status`,
      [id]
    );

    if (result && result.rows.length > 0) {
      return res.json({ message: `Booking ${id} rejected`, booking: result.rows[0] });
    }

    return res.json({ message: `Booking ${id} rejected` });
  } catch (err) {
    next(err);
  }
});

// GET /bookings/pending - Retrieve pending bookings
router.get('/pending', async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT id, passenger_id, driver_id, pickup_location, dropoff_location, status, created_at
       FROM rides WHERE status = 'requested' ORDER BY created_at DESC`
    );

    if (result) {
      return res.json({ message: 'Retrieved pending bookings', bookings: result.rows });
    }

    return res.json({ message: 'Retrieved pending bookings', bookings: [] });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

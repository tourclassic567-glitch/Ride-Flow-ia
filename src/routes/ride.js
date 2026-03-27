const express = require('express');
const { sanitizeObject } = require('../utils/sanitize');
const { success, error } = require('../utils/response');
const { createRide, updateRideStatus } = require('../services/rideService');
const { log } = require('../db');

const router = express.Router();

router.post('/create', async (req, res, next) => {
  try {
    const body = sanitizeObject(req.body);
    const { user_id, pickup, destination, price } = body;

    if (!user_id || !pickup || !destination || price == null || !Number.isFinite(Number(price))) {
      return res.status(400).json(
        error('ride_create', {
          message: 'user_id, pickup, destination, price are required'
        })
      );
    }

    const ride = await createRide({ user_id, pickup, destination, price });
    const payload = success('ride_create', ride);

    log('ride_create', body, payload, 'success');

    return res.status(201).json(payload);
  } catch (err) {
    err.action = 'ride_create';
    next(err);
  }
});

router.patch('/:id/status', async (req, res, next) => {
  try {
    const body = sanitizeObject(req.body);
    const { status } = body;
    const rideId = req.params.id;

    if (!rideId || !status) {
      return res.status(400).json(
        error('ride_status_update', {
          message: 'ride id and status are required'
        })
      );
    }

    const ride = await updateRideStatus(rideId, status);

    if (!ride) {
      return res.status(404).json(
        error('ride_status_update', {
          message: 'Ride not found'
        })
      );
    }

    const payload = success('ride_status_update', ride);

    log('ride_status_update', { rideId, status }, payload, 'success');

    return res.json(payload);
  } catch (err) {
    err.action = 'ride_status_update';
    next(err);
  }
});

module.exports = router;

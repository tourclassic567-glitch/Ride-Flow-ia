const express = require('express');
const { sanitizeObject } = require('../utils/sanitize');
const { success, error } = require('../utils/response');
const { createRide, updateRideStatus } = require('../services/rideService');
const { calculatePrice } = require('../services/pricingService');
const { log } = require('../db');

const router = express.Router();

router.post('/event', async (req, res, next) => {
  try {
    const payload = sanitizeObject(req.body);
    const { type, data } = payload;

    if (!type || !data || typeof data !== 'object') {
      return res.status(400).json(
        error('mike_event', {
          message: 'type and data are required'
        })
      );
    }

    switch (type) {
      case 'ride_created': {
        const { user_id, pickup, destination, price } = data;

        if (!user_id || !pickup || !destination || price == null || !Number.isFinite(Number(price))) {
          return res.status(400).json(
            error('ride_created', {
              message: 'user_id, pickup, destination, price are required'
            })
          );
        }

        const ride = await createRide({ user_id, pickup, destination, price });
        const output = success('ride_created', ride);

        log('ride_created', payload, output, 'success');

        return res.json(output);
      }

      case 'price_request': {
        const { distance_km, duration_min, surge } = data;

        if (distance_km == null || duration_min == null || !Number.isFinite(Number(distance_km)) || !Number.isFinite(Number(duration_min))) {
          return res.status(400).json(
            error('price_request', {
              message: 'distance_km and duration_min are required'
            })
          );
        }

        const result = calculatePrice({ distance_km, duration_min, surge });
        const output = success('price_request', result);

        log('price_request', payload, output, 'success');

        return res.json(output);
      }

      case 'ride_status_update': {
        const { ride_id, status } = data;

        if (!ride_id || !status) {
          return res.status(400).json(
            error('ride_status_update', {
              message: 'ride_id and status are required'
            })
          );
        }

        const ride = await updateRideStatus(ride_id, status);

        if (!ride) {
          return res.status(404).json(
            error('ride_status_update', {
              message: 'Ride not found'
            })
          );
        }

        const output = success('ride_status_update', ride);

        log('ride_status_update', payload, output, 'success');

        return res.json(output);
      }

      default: {
        const output = error('mike_event', {
          message: `Unsupported event type: ${type}`
        });

        log('mike_event', payload, output, 'error');

        return res.status(400).json(output);
      }
    }
  } catch (err) {
    err.action = 'mike_event';
    next(err);
  }
});

module.exports = router;

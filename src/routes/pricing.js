const express = require('express');
const { sanitizeObject } = require('../utils/sanitize');
const { success, error } = require('../utils/response');
const { calculatePrice } = require('../services/pricingService');
const { log } = require('../db');

const router = express.Router();

router.post('/calculate', async (req, res, next) => {
  try {
    const body = sanitizeObject(req.body);
    const { distance_km, duration_min, surge } = body;

    if (distance_km == null || duration_min == null) {
      return res.status(400).json(
        error('price_calculate', {
          message: 'distance_km and duration_min are required'
        })
      );
    }

    const result = calculatePrice({ distance_km, duration_min, surge });
    const payload = success('price_calculate', result);

    log('price_calculate', body, payload, 'success');

    return res.json(payload);
  } catch (err) {
    err.action = 'price_calculate';
    next(err);
  }
});

module.exports = router;

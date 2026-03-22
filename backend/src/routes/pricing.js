const express = require('express');
const router = express.Router();
const { validatePricing } = require('../middleware/validate');

// POST /pricing/calculate
router.post('/calculate', validatePricing, (req, res, next) => {
  try {
    const { pickup_location, dropoff_location, ride_type = 'standard' } = req.body;

    const base_fare = 2.50;
    const price_per_mile = 1.50;
    const estimated_distance = parseFloat((Math.random() * 18 + 2).toFixed(2)); // 2–20 miles
    const surge_multiplier = parseFloat((Math.random() * 1.0 + 1.0).toFixed(2)); // 1.0–2.0
    const final_price = parseFloat(
      ((base_fare + estimated_distance * price_per_mile) * surge_multiplier).toFixed(2)
    );

    return res.json({
      estimated_price: final_price,
      currency: 'USD',
      breakdown: {
        base_fare,
        distance_estimate: estimated_distance,
        price_per_mile,
        surge_multiplier,
      },
      surge_active: surge_multiplier > 1.2,
      pickup_location,
      dropoff_location,
      ride_type,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;

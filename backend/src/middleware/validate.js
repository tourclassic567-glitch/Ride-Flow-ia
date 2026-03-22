function validateRideRequest(req, res, next) {
  const { passenger_id, pickup_location, dropoff_location } = req.body;
  if (!passenger_id) return res.status(400).json({ error: 'passenger_id is required' });
  if (!pickup_location) return res.status(400).json({ error: 'pickup_location is required' });
  if (!dropoff_location) return res.status(400).json({ error: 'dropoff_location is required' });
  next();
}

function validateRideMatch(req, res, next) {
  const { ride_id } = req.body;
  if (!ride_id) return res.status(400).json({ error: 'ride_id is required' });
  next();
}

function validatePricing(req, res, next) {
  const { pickup_location, dropoff_location } = req.body;
  if (!pickup_location) return res.status(400).json({ error: 'pickup_location is required' });
  if (!dropoff_location) return res.status(400).json({ error: 'dropoff_location is required' });
  next();
}

module.exports = { validateRideRequest, validateRideMatch, validatePricing };

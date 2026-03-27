function calculatePrice({ distance_km, duration_min, surge = 1 }) {
  const BASE_FARE = 2.5;
  const COST_PER_KM = 1.2;
  const COST_PER_MIN = 0.25;

  let total =
    BASE_FARE +
    (Number(distance_km) * COST_PER_KM) +
    (Number(duration_min) * COST_PER_MIN);

  total *= Number(surge);

  return {
    estimated_price: Number(total.toFixed(2)),
    currency: 'USD'
  };
}

module.exports = { calculatePrice };

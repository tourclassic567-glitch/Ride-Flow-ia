const { query, log } = require('../db');

async function createRide({ user_id, pickup, destination, price }) {
  const result = await query(
    `INSERT INTO rides (user_id, pickup, destination, price, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING *`,
    [user_id, pickup, destination, price]
  );

  const ride = result.rows[0];

  log('ride_created', { user_id, pickup, destination, price }, ride, 'success');

  return ride;
}

async function updateRideStatus(rideId, status) {
  const result = await query(
    `UPDATE rides
     SET status = $1
     WHERE id = $2
     RETURNING *`,
    [status, rideId]
  );

  return result.rows[0] || null;
}

module.exports = {
  createRide,
  updateRideStatus
};

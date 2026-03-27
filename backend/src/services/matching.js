const db = require('../db');

const MOCK_DRIVER = {
  id: 1,
  user_id: 1,
  status: 'online',
  latitude: 25.7617,
  longitude: -80.1918,
};

async function findNearestDriver(rideIdOrObj) {
  // Accept either a plain ride_id value or an object { ride_id }
  const ride_id = rideIdOrObj && typeof rideIdOrObj === 'object' ? rideIdOrObj.ride_id : rideIdOrObj;
  const result = await db.query(
    `SELECT * FROM drivers WHERE status = 'online' LIMIT 10`
  );

  let driver;

  if (result && result.rows.length > 0) {
    driver = result.rows[Math.floor(Math.random() * result.rows.length)];

    // Update driver status to on_ride
    await db.query(
      `UPDATE drivers SET status = 'on_ride', updated_at = NOW() WHERE id = $1`,
      [driver.id]
    );

    // Update ride status to matched with assigned driver
    await db.query(
      `UPDATE rides SET status = 'matched', driver_id = $1 WHERE id = $2`,
      [driver.id, ride_id]
    );
  } else {
    // Mock mode: no DB or no online drivers
    driver = MOCK_DRIVER;
  }

  return driver;
}

module.exports = { findNearestDriver };

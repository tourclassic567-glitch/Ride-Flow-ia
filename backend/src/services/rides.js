'use strict';

const db = require('../db');

// Pricing constants
const BASE_FARE = 2.5;
const PRICE_PER_MILE = 1.5;
const ESTIMATED_MILES_DEFAULT = 5;
const MAX_ADDITIONAL_MILES = 18;
const MIN_MILES = 2;
const MAX_SURGE_FACTOR = 1.0;
const MIN_SURGE_MULTIPLIER = 1.0;

/**
 * Rides service — exposes methods consumed by the flow engine.
 * All methods accept a plain object and return a plain object.
 */

async function validateRequest({ passenger_id, pickup, dropoff }) {
  if (!passenger_id) throw new Error('passenger_id is required');
  if (!pickup) throw new Error('pickup location is required');
  if (!dropoff) throw new Error('dropoff location is required');

  return {
    passengerId: passenger_id,
    pickup,
    dropoff,
    validated: true,
  };
}

async function createRide({ passenger_id, pickup, dropoff }) {
  const estimated_price = parseFloat((BASE_FARE + ESTIMATED_MILES_DEFAULT * PRICE_PER_MILE).toFixed(2));

  const result = await db.query(
    `INSERT INTO rides (passenger_id, pickup_location, dropoff_location, price, status)
     VALUES ($1, $2, $3, $4, 'requested')
     RETURNING id, status, pickup_location, dropoff_location, price, created_at`,
    [passenger_id, pickup, dropoff, estimated_price]
  );

  if (result && result.rows.length > 0) {
    const ride = result.rows[0];
    return {
      ride_id: ride.id,
      status: ride.status,
      pickup_location: ride.pickup_location,
      dropoff_location: ride.dropoff_location,
      price: parseFloat(ride.price),
      created_at: ride.created_at,
    };
  }

  // Mock when DB not available
  return {
    ride_id: Date.now(),
    status: 'requested',
    pickup_location: pickup,
    dropoff_location: dropoff,
    price: estimated_price,
    created_at: new Date().toISOString(),
  };
}

async function calculatePrice({ ride_id }) {
  const estimated_miles = parseFloat((Math.random() * MAX_ADDITIONAL_MILES + MIN_MILES).toFixed(2));
  const surge_multiplier = parseFloat((Math.random() * MAX_SURGE_FACTOR + MIN_SURGE_MULTIPLIER).toFixed(2));
  const price = parseFloat(
    ((BASE_FARE + estimated_miles * PRICE_PER_MILE) * surge_multiplier).toFixed(2)
  );

  if (ride_id) {
    await db.query(`UPDATE rides SET price = $1 WHERE id = $2`, [price, ride_id]).catch(() => {});
  }

  return { ride_id, price, surge_multiplier, estimated_miles };
}

async function cancelRide({ ride_id }) {
  await db
    .query(`UPDATE rides SET status = 'cancelled', completed_at = NOW() WHERE id = $1`, [ride_id])
    .catch(() => {});
  return { ride_id, status: 'cancelled' };
}

async function getRide({ ride_id }) {
  const result = await db.query(`SELECT * FROM rides WHERE id = $1`, [ride_id]);
  if (result && result.rows.length > 0) return result.rows[0];
  return { ride_id, status: 'unknown' };
}

async function updateStatus({ ride_id, status }) {
  await db
    .query(`UPDATE rides SET status = $1 WHERE id = $2`, [status, ride_id])
    .catch(() => {});
  return { ride_id, status };
}

module.exports = {
  validateRequest,
  createRide,
  calculatePrice,
  cancelRide,
  getRide,
  updateStatus,
};

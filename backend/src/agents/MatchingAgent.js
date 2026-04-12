/**
 * MatchingAgent — intelligent autonomous driver-passenger matching.
 *
 * Every tick it:
 *  1. Finds all unmatched ride requests that have been waiting.
 *  2. Scores available online drivers by proximity (Haversine distance).
 *  3. Assigns the closest driver and updates both records.
 *  4. Broadcasts a RIDE_MATCHED event via WebSocket.
 *
 * Falls back to random selection when location data is missing.
 */
const BaseAgent = require('./BaseAgent');
const db = require('../db');

let _broadcast = null;

/** Haversine distance in miles between two lat/lon pairs */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Very basic geocoder for demo: returns lat/lon from a string like
 * "25.7617,-80.1918" or returns a default Miami coordinate.
 */
function parseLocation(str) {
  if (!str) return null;
  const parts = str.split(',').map(Number);
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { lat: parts[0], lon: parts[1] };
  }
  return null;
}

class MatchingAgent extends BaseAgent {
  constructor() {
    super('MatchingAgent', 15_000); // every 15 s
    this.matchedCount = 0;
  }

  inject({ broadcast }) {
    _broadcast = broadcast;
  }

  async tick() {
    // Get unmatched rides older than 5 seconds (avoid racing with the request handler)
    const ridesRes = await db.query(
      `SELECT id, pickup_location, passenger_id FROM rides
       WHERE status = 'requested' AND created_at < NOW() - INTERVAL '5 seconds'
       ORDER BY created_at ASC LIMIT 10`
    );
    if (!ridesRes || ridesRes.rows.length === 0) return;

    // Get all online drivers
    const driversRes = await db.query(
      `SELECT id, latitude, longitude FROM drivers WHERE status = 'online'`
    );
    if (!driversRes || driversRes.rows.length === 0) return;

    for (const ride of ridesRes.rows) {
      const pickup = parseLocation(ride.pickup_location);
      let bestDriver = null;
      let bestDist = Infinity;

      for (const driver of driversRes.rows) {
        if (pickup && driver.latitude != null && driver.longitude != null) {
          const dist = haversine(pickup.lat, pickup.lon, driver.latitude, driver.longitude);
          if (dist < bestDist) {
            bestDist = dist;
            bestDriver = driver;
          }
        } else {
          // No geo data — pick first available
          bestDriver = bestDriver || driver;
        }
      }

      if (!bestDriver) continue;

      // Assign in DB
      await db.query(
        `UPDATE rides SET status = 'matched', driver_id = $1 WHERE id = $2 AND status = 'requested'`,
        [bestDriver.id, ride.id]
      );
      await db.query(
        `UPDATE drivers SET status = 'on_ride', updated_at = NOW() WHERE id = $1`,
        [bestDriver.id]
      );

      this.matchedCount++;

      if (_broadcast) {
        _broadcast({
          type: 'RIDE_MATCHED',
          ride_id: ride.id,
          driver_id: bestDriver.id,
          distance_miles: bestDist === Infinity ? null : parseFloat(bestDist.toFixed(2)),
          matched_by: 'MatchingAgent',
        });
      }

      console.log(
        `[MatchingAgent] ride=${ride.id} → driver=${bestDriver.id} (${
          bestDist === Infinity ? 'no-geo' : bestDist.toFixed(2) + ' mi'
        })`
      );
    }
  }
}

module.exports = new MatchingAgent();

/**
 * PricingAgent — AI-driven dynamic surge pricing that stays competitive.
 *
 * Every tick it:
 *  1. Counts online drivers and pending ride requests.
 *  2. Calculates a demand ratio and derives a surge multiplier.
 *  3. Stores the current pricing snapshot in the demand_metrics table.
 *  4. Broadcasts the new multiplier via WebSocket so clients update in real-time.
 *
 * Surge logic (beats competition):
 *  - demand_ratio = pending_rides / max(online_drivers, 1)
 *  - multiplier capped at 2.5× (avoids price-gouging complaints)
 *  - Always at least 1.0× (no artificial discounts at idle)
 */
const BaseAgent = require('./BaseAgent');
const db = require('../db');

// Will be injected by orchestrator after websocket init
let _broadcast = null;

class PricingAgent extends BaseAgent {
  constructor() {
    super('PricingAgent', 30_000); // every 30 s
    this.currentMultiplier = 1.0;
  }

  inject({ broadcast }) {
    _broadcast = broadcast;
  }

  async tick() {
    const driversRes = await db.query(
      `SELECT COUNT(*) AS cnt FROM drivers WHERE status = 'online'`
    );
    const ridesRes = await db.query(
      `SELECT COUNT(*) AS cnt FROM rides WHERE status = 'requested'`
    );

    let onlineDrivers = 1;
    let pendingRides = 0;

    if (driversRes) onlineDrivers = Math.max(parseInt(driversRes.rows[0].cnt, 10), 1);
    if (ridesRes) pendingRides = parseInt(ridesRes.rows[0].cnt, 10);

    const demandRatio = pendingRides / onlineDrivers;

    // Piecewise surge curve
    let surge;
    if (demandRatio <= 0.5) surge = 1.0;
    else if (demandRatio <= 1.0) surge = 1.0 + (demandRatio - 0.5) * 0.8;
    else if (demandRatio <= 2.0) surge = 1.4 + (demandRatio - 1.0) * 0.6;
    else surge = Math.min(2.0 + (demandRatio - 2.0) * 0.25, 2.5);

    surge = parseFloat(surge.toFixed(2));
    this.currentMultiplier = surge;

    // Persist snapshot
    await db.query(
      `INSERT INTO demand_metrics (online_drivers, pending_rides, surge_multiplier, recorded_at)
       VALUES ($1, $2, $3, NOW())`,
      [onlineDrivers, pendingRides, surge]
    ).catch(() => {}); // non-fatal if table absent

    // Real-time broadcast
    if (_broadcast) {
      _broadcast({ type: 'SURGE_UPDATE', surge_multiplier: surge });
    }

    console.log(
      `[PricingAgent] drivers=${onlineDrivers} rides=${pendingRides} surge=${surge}×`
    );
  }

  getSurgeMultiplier() {
    return this.currentMultiplier;
  }
}

module.exports = new PricingAgent();

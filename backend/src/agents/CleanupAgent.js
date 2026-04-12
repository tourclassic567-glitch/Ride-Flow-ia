/**
 * CleanupAgent — continuous resource management and housekeeping.
 *
 * Every tick (default 1 h) it:
 *  1. Cancels rides that have been in 'requested' state > STALE_RIDE_MINUTES (default 30 min).
 *  2. Sets drivers that have been 'on_ride' for > MAX_RIDE_HOURS back to 'online'
 *     (handles crashed sessions / ghost rides).
 *  3. Deletes demand_metrics older than METRICS_RETENTION_DAYS (default 7).
 *  4. Reports cleanup counts in agent_logs.
 */
const BaseAgent = require('./BaseAgent');
const db = require('../db');

const INTERVAL_MS         = parseInt(process.env.CLEANUP_INTERVAL_MS || String(60 * 60 * 1000), 10);
const STALE_RIDE_MINUTES  = parseInt(process.env.STALE_RIDE_MINUTES  || '30', 10);
const MAX_RIDE_HOURS      = parseInt(process.env.MAX_RIDE_HOURS       || '6',  10);
const METRICS_RETENTION_DAYS = parseInt(process.env.METRICS_RETENTION_DAYS || '7', 10);

class CleanupAgent extends BaseAgent {
  constructor() {
    super('CleanupAgent', INTERVAL_MS);
  }

  async tick() {
    const staleRidesRes = await db.query(
      `UPDATE rides SET status = 'cancelled'
       WHERE status = 'requested'
         AND created_at < NOW() - ($1 || ' minutes')::INTERVAL
       RETURNING id`,
      [STALE_RIDE_MINUTES]
    ).catch(() => null);

    const staleDriversRes = await db.query(
      `UPDATE drivers SET status = 'online', updated_at = NOW()
       WHERE status = 'on_ride'
         AND updated_at < NOW() - ($1 || ' hours')::INTERVAL
       RETURNING id`,
      [MAX_RIDE_HOURS]
    ).catch(() => null);

    const metricsRes = await db.query(
      `DELETE FROM demand_metrics
       WHERE recorded_at < NOW() - ($1 || ' days')::INTERVAL`,
      [METRICS_RETENTION_DAYS]
    ).catch(() => null);

    const summary = {
      staleRidesCancelled: staleRidesRes ? staleRidesRes.rowCount : 0,
      ghostDriversReset:   staleDriversRes ? staleDriversRes.rowCount : 0,
      metricsRowsDeleted:  metricsRes ? metricsRes.rowCount : 0,
    };

    await db.query(
      `INSERT INTO agent_logs (agent_name, event_type, payload, created_at)
       VALUES ('CleanupAgent', 'cleanup_run', $1::jsonb, NOW())`,
      [JSON.stringify(summary)]
    ).catch(() => {});

    console.log(
      `[CleanupAgent] stale_rides=${summary.staleRidesCancelled} ghost_drivers=${summary.ghostDriversReset} metrics_pruned=${summary.metricsRowsDeleted}`
    );
  }
}

module.exports = new CleanupAgent();

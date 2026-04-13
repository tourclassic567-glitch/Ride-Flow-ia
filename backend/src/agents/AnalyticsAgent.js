/**
 * AnalyticsAgent — daily reporting, anomaly detection, and dashboard broadcasting.
 *
 * Every tick (default 1 h) it:
 *  1. Computes KPIs for the last 24 h (rides, revenue, avg fare, completion rate).
 *  2. Compares against the previous 24 h window to detect anomalies.
 *  3. Broadcasts a DAILY_ANALYTICS event for live dashboard updates.
 *  4. Persists the report in agent_logs.
 *
 * Anomaly detection heuristic:
 *  - A metric is flagged if it deviates > ANOMALY_THRESHOLD_PCT (default 30 %)
 *    from the baseline (previous window).
 */
const BaseAgent = require('./BaseAgent');
const db        = require('../db');

const INTERVAL_MS          = parseInt(process.env.ANALYTICS_INTERVAL_MS     || String(60 * 60 * 1000), 10);
const ANOMALY_THRESHOLD_PCT = parseInt(process.env.ANALYTICS_ANOMALY_PCT    || '30', 10);

let _broadcast = null;

class AnalyticsAgent extends BaseAgent {
  constructor() {
    super('AnalyticsAgent', INTERVAL_MS);
    this.lastReport = null;
  }

  inject({ broadcast }) {
    _broadcast = broadcast;
  }

  async tick() {
    const current  = await this._windowStats(24, 0);
    const previous = await this._windowStats(48, 24);

    const anomalies = this._detectAnomalies(current, previous);

    const report = {
      generatedAt:     new Date().toISOString(),
      period:          '24h',
      current,
      previous,
      anomalies,
    };

    this.lastReport = report;

    if (_broadcast) {
      _broadcast({ type: 'DAILY_ANALYTICS', report });
    }

    if (anomalies.length > 0 && _broadcast) {
      _broadcast({
        type:     'ANALYTICS_ANOMALY',
        severity: 'warning',
        message:  `${anomalies.length} metric anomal${anomalies.length === 1 ? 'y' : 'ies'} detected`,
        anomalies,
      });
    }

    await db.query(
      `INSERT INTO agent_logs (agent_name, event_type, payload, created_at)
       VALUES ('AnalyticsAgent', 'analytics_report', $1::jsonb, NOW())`,
      [JSON.stringify(report)]
    ).catch(() => {});

    console.log(
      `[AnalyticsAgent] rides=${current.totalRides} revenue=$${current.totalRevenue.toFixed(2)} anomalies=${anomalies.length}`
    );
  }

  async _windowStats(windowHoursFrom, windowHoursTo) {
    const ridesRes = await db.query(
      `SELECT
         COUNT(*)                                                      AS total_rides,
         COUNT(*) FILTER (WHERE r.status = 'completed')               AS completed_rides,
         COUNT(*) FILTER (WHERE r.status = 'cancelled')               AS cancelled_rides,
         COALESCE(SUM(p.amount), 0)                                   AS total_revenue,
         COALESCE(AVG(p.amount), 0)                                   AS avg_fare
       FROM rides r
       LEFT JOIN payments p ON p.ride_id = r.id AND p.status = 'completed'
       WHERE r.created_at BETWEEN NOW() - ($1 || ' hours')::INTERVAL
                               AND NOW() - ($2 || ' hours')::INTERVAL`,
      [windowHoursFrom, windowHoursTo]
    ).catch(() => null);

    const activeDriversRes = await db.query(
      `SELECT COUNT(DISTINCT driver_id) AS cnt
       FROM rides
       WHERE status IN ('matched', 'in_progress', 'completed')
         AND created_at BETWEEN NOW() - ($1 || ' hours')::INTERVAL
                             AND NOW() - ($2 || ' hours')::INTERVAL`,
      [windowHoursFrom, windowHoursTo]
    ).catch(() => null);

    const row = ridesRes?.rows[0] ?? {};
    const totalRides     = parseInt(row.total_rides     ?? 0, 10);
    const completedRides = parseInt(row.completed_rides ?? 0, 10);

    return {
      totalRides,
      completedRides,
      cancelledRides:   parseInt(row.cancelled_rides  ?? 0, 10),
      totalRevenue:     parseFloat(row.total_revenue   ?? 0),
      avgFare:          parseFloat((row.avg_fare ?? 0).toFixed(2)),
      completionRate:   totalRides > 0 ? parseFloat((completedRides / totalRides * 100).toFixed(1)) : 0,
      activeDrivers:    parseInt(activeDriversRes?.rows[0]?.cnt ?? 0, 10),
    };
  }

  _detectAnomalies(current, previous) {
    const metrics = ['totalRides', 'totalRevenue', 'avgFare', 'completionRate', 'activeDrivers'];
    const anomalies = [];

    for (const key of metrics) {
      const cur  = current[key]  ?? 0;
      const prev = previous[key] ?? 0;

      if (prev === 0) continue; // no baseline to compare

      const changePct = Math.abs((cur - prev) / prev) * 100;
      if (changePct > ANOMALY_THRESHOLD_PCT) {
        anomalies.push({
          metric:    key,
          current:   cur,
          previous:  prev,
          changePct: parseFloat(changePct.toFixed(1)),
          direction: cur > prev ? 'up' : 'down',
        });
      }
    }

    return anomalies;
  }

  getLastReport() {
    return this.lastReport;
  }
}

module.exports = new AnalyticsAgent();

/**
 * AnalyticsAgent — daily reports, anomaly detection, and dashboard metrics.
 *
 * Every tick (default 10 min) it:
 *  1. Computes a rolling hourly revenue / ride KPI snapshot.
 *  2. Runs a simple Z-score anomaly check on the surge multiplier history.
 *  3. Stores the dashboard snapshot in agent_logs.
 *  4. Broadcasts a ANALYTICS_UPDATE WebSocket event.
 */
const BaseAgent = require('./BaseAgent');
const db = require('../db');

const INTERVAL_MS = parseInt(process.env.ANALYTICS_INTERVAL_MS || String(10 * 60_000), 10);

let _broadcast = null;

class AnalyticsAgent extends BaseAgent {
  constructor() {
    super('AnalyticsAgent', INTERVAL_MS);
    this.lastSnapshot = null;
    this.surgeHistory = []; // rolling window of surge multipliers
  }

  inject({ broadcast }) {
    _broadcast = broadcast;
  }

  async tick() {
    const ridesRes = await db.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'completed')  AS completed,
         COUNT(*) FILTER (WHERE status = 'requested')  AS pending,
         COUNT(*) FILTER (WHERE status = 'cancelled')  AS cancelled,
         COUNT(*)                                       AS total
       FROM rides
       WHERE created_at > NOW() - INTERVAL '24 hours'`
    ).catch(() => null);

    const revenueRes = await db.query(
      `SELECT COALESCE(SUM(amount), 0) AS revenue
       FROM payments
       WHERE status = 'completed' AND created_at > NOW() - INTERVAL '24 hours'`
    ).catch(() => null);

    const surgeRes = await db.query(
      `SELECT surge_multiplier FROM demand_metrics
       ORDER BY recorded_at DESC LIMIT 50`
    ).catch(() => null);

    const surgeValues = surgeRes
      ? surgeRes.rows.map((r) => parseFloat(r.surge_multiplier))
      : [];

    // Keep rolling history for anomaly detection
    this.surgeHistory.push(...surgeValues);
    this.surgeHistory = this.surgeHistory.slice(-200);

    const anomalies = this._detectAnomalies(this.surgeHistory);

    const snapshot = {
      generatedAt: new Date().toISOString(),
      rides: ridesRes
        ? {
            total:     parseInt(ridesRes.rows[0].total,     10),
            completed: parseInt(ridesRes.rows[0].completed, 10),
            pending:   parseInt(ridesRes.rows[0].pending,   10),
            cancelled: parseInt(ridesRes.rows[0].cancelled, 10),
          }
        : { total: 0, completed: 0, pending: 0, cancelled: 0 },
      revenue24h: revenueRes ? parseFloat(revenueRes.rows[0].revenue) : 0,
      surgeAnomalies: anomalies,
    };

    this.lastSnapshot = snapshot;

    if (_broadcast) {
      _broadcast({ type: 'ANALYTICS_UPDATE', snapshot });
    }

    await db.query(
      `INSERT INTO agent_logs (agent_name, event_type, payload, created_at)
       VALUES ('AnalyticsAgent', 'dashboard_snapshot', $1::jsonb, NOW())`,
      [JSON.stringify(snapshot)]
    ).catch(() => {});

    console.log(
      `[AnalyticsAgent] rides=${snapshot.rides.total} revenue=$${snapshot.revenue24h.toFixed(2)} anomalies=${anomalies.length}`
    );
  }

  /**
   * Z-score anomaly detection on surge multiplier series.
   * Returns indices of values > threshold standard deviations from the mean.
   */
  _detectAnomalies(values, threshold = 2.5) {
    if (values.length < 5) return [];
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev === 0) return [];
    return values
      .map((v, i) => ({ index: i, value: v, zScore: Math.abs((v - mean) / stdDev) }))
      .filter((e) => e.zScore > threshold);
  }

  getLastSnapshot() {
    return this.lastSnapshot;
  }
}

module.exports = new AnalyticsAgent();

/**
 * AnalyticsAgent — daily reporting, anomaly prediction, and dashboard data.
 *
 * Every tick (default 10 min) it:
 *  1. Computes ride and revenue KPIs for the last 24 h.
 *  2. Runs a simple anomaly check: flags hours where demand deviates > 2 σ from mean.
 *  3. Persists an analytics snapshot in agent_logs.
 *  4. Broadcasts an ANALYTICS_UPDATE event so the dashboard refreshes.
 */
const BaseAgent = require('./BaseAgent');
const db        = require('../db');
const scheduler = require('../services/scheduler');

const INTERVAL_MS = parseInt(process.env.ANALYTICS_INTERVAL_MS || String(10 * 60 * 1000), 10);

let _broadcast = null;

class AnalyticsAgent extends BaseAgent {
  constructor() {
    super('AnalyticsAgent', INTERVAL_MS);
    this.lastSnapshot = null;

    scheduler.register('AnalyticsAgent.report', {
      description: 'Daily KPI report & anomaly detection',
      intervalMs:  INTERVAL_MS,
      status:      'scheduled',
      nextRunAt:   new Date(Date.now() + INTERVAL_MS).toISOString(),
      lastRunAt:   null,
    });
  }

  inject({ broadcast }) {
    _broadcast = broadcast;
  }

  async tick() {
    // --- KPIs ---
    const kpiRes = await db.query(
      `SELECT
         COUNT(*)                                  AS total_rides,
         COUNT(*) FILTER (WHERE status='completed') AS completed_rides,
         COUNT(*) FILTER (WHERE status='cancelled') AS cancelled_rides,
         COALESCE(AVG(p.amount), 0)                AS avg_revenue_per_ride
       FROM rides r
       LEFT JOIN payments p ON p.ride_id = r.id AND p.status = 'completed'
       WHERE r.created_at > NOW() - INTERVAL '24 hours'`
    ).catch(() => null);

    // --- Hourly demand for anomaly detection ---
    const demandRes = await db.query(
      `SELECT EXTRACT(HOUR FROM recorded_at) AS hour,
              AVG(pending_rides) AS avg_demand
       FROM demand_metrics
       WHERE recorded_at > NOW() - INTERVAL '24 hours'
       GROUP BY hour ORDER BY hour`
    ).catch(() => null);

    const hourlyDemand = demandRes ? demandRes.rows.map((r) => ({
      hour:       parseInt(r.hour, 10),
      avgDemand:  parseFloat(parseFloat(r.avg_demand).toFixed(2)),
    })) : [];

    const anomalies = this._detectAnomalies(hourlyDemand);

    const snapshot = {
      period:          '24h',
      totalRides:      kpiRes ? parseInt(kpiRes.rows[0].total_rides, 10) : 0,
      completedRides:  kpiRes ? parseInt(kpiRes.rows[0].completed_rides, 10) : 0,
      cancelledRides:  kpiRes ? parseInt(kpiRes.rows[0].cancelled_rides, 10) : 0,
      avgRevenuePerRide: kpiRes ? parseFloat(parseFloat(kpiRes.rows[0].avg_revenue_per_ride).toFixed(2)) : 0,
      hourlyDemand,
      anomalies,
      generatedAt: new Date().toISOString(),
    };

    this.lastSnapshot = snapshot;

    if (_broadcast) {
      _broadcast({ type: 'ANALYTICS_UPDATE', snapshot });
    }

    await db.query(
      `INSERT INTO agent_logs (agent_name, event_type, payload, created_at)
       VALUES ('AnalyticsAgent', 'analytics_snapshot', $1::jsonb, NOW())`,
      [JSON.stringify(snapshot)]
    ).catch(() => {});

    scheduler.update('AnalyticsAgent.report', {
      lastRunAt: new Date().toISOString(),
      nextRunAt: new Date(Date.now() + INTERVAL_MS).toISOString(),
      status:    'scheduled',
    });

    console.log(
      `[AnalyticsAgent] rides=${snapshot.totalRides} completed=${snapshot.completedRides} anomalies=${anomalies.length}`
    );
  }

  /**
   * Flag hours where avgDemand deviates more than 2 standard deviations from the mean.
   * Uses sample variance (N-1) for a more accurate estimate.
   */
  _detectAnomalies(hourlyDemand) {
    if (hourlyDemand.length < 3) return [];

    const values = hourlyDemand.map((h) => h.avgDemand);
    const mean   = values.reduce((s, v) => s + v, 0) / values.length;
    // Use sample variance (N-1) for statistical correctness
    const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (values.length - 1);
    const stdDev = Math.sqrt(variance);

    // No anomalies can exist when all values are identical (zero variance)
    if (stdDev === 0) return [];

    return hourlyDemand
      .filter((h) => Math.abs(h.avgDemand - mean) > 2 * stdDev)
      .map((h) => ({ ...h, deviation: parseFloat(((h.avgDemand - mean) / stdDev).toFixed(2)) }));
  }

  getLastSnapshot() {
    return this.lastSnapshot;
  }
}

module.exports = new AnalyticsAgent();

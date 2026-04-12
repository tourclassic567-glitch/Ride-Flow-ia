/**
 * RevenueAgent — autonomous revenue analytics, demand forecasting, and driver incentives.
 *
 * Every tick (default 5 min) it:
 *  1. Calculates total revenue and ride counts for the last 24 h.
 *  2. Computes an hourly demand trend from demand_metrics.
 *  3. Detects "dead zones" (hours with 0 rides) and suggests incentives.
 *  4. Broadcasts a REVENUE_REPORT event so dashboards can update live.
 *  5. Persists the report in agent_logs for historical analysis.
 */
const BaseAgent = require('./BaseAgent');
const db = require('../db');

const INTERVAL_MS = parseInt(process.env.REVENUE_INTERVAL_MS || String(5 * 60 * 1000), 10);

let _broadcast = null;

class RevenueAgent extends BaseAgent {
  constructor() {
    super('RevenueAgent', INTERVAL_MS);
    this.lastReport = null;
  }

  inject({ broadcast }) {
    _broadcast = broadcast;
  }

  async tick() {
    const revenueRes = await db.query(
      `SELECT
         COUNT(*)          AS total_rides,
         COALESCE(SUM(p.amount), 0) AS total_revenue
       FROM rides r
       LEFT JOIN payments p ON p.ride_id = r.id AND p.status = 'completed'
       WHERE r.created_at > NOW() - INTERVAL '24 hours'`
    ).catch(() => null);

    const completedRes = await db.query(
      `SELECT COUNT(*) AS cnt FROM rides
       WHERE status = 'completed' AND completed_at > NOW() - INTERVAL '24 hours'`
    ).catch(() => null);

    const demandRes = await db.query(
      `SELECT EXTRACT(HOUR FROM recorded_at) AS hour,
              AVG(surge_multiplier) AS avg_surge,
              AVG(pending_rides)    AS avg_demand
       FROM demand_metrics
       WHERE recorded_at > NOW() - INTERVAL '24 hours'
       GROUP BY hour ORDER BY hour`
    ).catch(() => null);

    const report = {
      period: '24h',
      generatedAt: new Date().toISOString(),
      totalRides: revenueRes ? parseInt(revenueRes.rows[0].total_rides, 10) : 0,
      completedRides: completedRes ? parseInt(completedRes.rows[0].cnt, 10) : 0,
      totalRevenue: revenueRes ? parseFloat(revenueRes.rows[0].total_revenue) : 0,
      hourlyDemand: demandRes ? demandRes.rows : [],
      incentiveSuggestions: this._computeIncentives(demandRes ? demandRes.rows : []),
    };

    this.lastReport = report;

    if (_broadcast) {
      _broadcast({ type: 'REVENUE_REPORT', report });
    }

    await db.query(
      `INSERT INTO agent_logs (agent_name, event_type, payload, created_at)
       VALUES ('RevenueAgent', 'revenue_report', $1::jsonb, NOW())`,
      [JSON.stringify(report)]
    ).catch(() => {});

    console.log(
      `[RevenueAgent] rides=${report.totalRides} revenue=$${report.totalRevenue.toFixed(2)} incentives=${report.incentiveSuggestions.length}`
    );
  }

  /**
   * Simple heuristic: offer a bonus to drivers during low-demand hours.
   * Returns an array of { hour, bonus_pct } suggestions.
   */
  _computeIncentives(hourlyRows) {
    if (!hourlyRows.length) return [];

    const avgDemand =
      hourlyRows.reduce((s, r) => s + parseFloat(r.avg_demand), 0) / hourlyRows.length;

    return hourlyRows
      .filter((r) => parseFloat(r.avg_demand) < avgDemand * 0.5)
      .map((r) => ({
        hour: parseInt(r.hour, 10),
        avg_demand: parseFloat(parseFloat(r.avg_demand).toFixed(2)),
        bonus_pct: 15, // 15% driver bonus for low-demand slots
      }));
  }

  getLastReport() {
    return this.lastReport;
  }
}

module.exports = new RevenueAgent();

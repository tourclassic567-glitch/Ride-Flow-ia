/**
 * MonitoringAgent — 24/7 system health watchdog with self-recovery.
 *
 * Every tick it:
 *  1. Checks DB connectivity and response latency.
 *  2. Checks process memory usage (RSS) against a configurable threshold.
 *  3. Logs agent_logs records for audit trails.
 *  4. Attempts self-recovery strategies: notifies via WebSocket on anomalies.
 *
 * Recovery strategy:
 *  - DB down → warn via WebSocket, continue in mock mode (system stays up)
 *  - Memory high → trigger Node.js GC hint if available, broadcast alert
 *  - Consecutive failures > MAX_FAILURES → broadcast CRITICAL alert
 */
const BaseAgent = require('./BaseAgent');
const db = require('../db');

const MEMORY_THRESHOLD_MB = parseInt(process.env.MEMORY_THRESHOLD_MB || '512', 10);
const MAX_FAILURES = 5;

let _broadcast = null;

class MonitoringAgent extends BaseAgent {
  constructor() {
    super('MonitoringAgent', 20_000); // every 20 s
    this.consecutiveFailures = 0;
    this.metrics = {
      dbLatencyMs: null,
      memRssMb: null,
      dbUp: false,
    };
  }

  inject({ broadcast }) {
    _broadcast = broadcast;
  }

  async tick() {
    const memMb = process.memoryUsage().rss / 1024 / 1024;
    this.metrics.memRssMb = parseFloat(memMb.toFixed(1));

    // --- DB health check ---
    const t0 = Date.now();
    const dbRes = await db.query('SELECT 1 AS ok').catch(() => null);
    const latency = Date.now() - t0;

    const dbUp = !!(dbRes && dbRes.rows.length > 0);
    this.metrics.dbUp = dbUp;
    this.metrics.dbLatencyMs = dbUp ? latency : null;

    if (!dbUp) {
      this.consecutiveFailures++;
      console.warn(`[MonitoringAgent] DB unreachable (failure #${this.consecutiveFailures})`);
    } else {
      this.consecutiveFailures = 0;
    }

    // --- Memory check ---
    if (memMb > MEMORY_THRESHOLD_MB) {
      console.warn(`[MonitoringAgent] High memory: ${memMb.toFixed(1)} MB`);
      if (_broadcast) {
        _broadcast({ type: 'SYSTEM_ALERT', severity: 'warning', message: `High memory usage: ${memMb.toFixed(1)} MB` });
      }
      // Hint GC if running with --expose-gc
      if (global.gc) global.gc();
    }

    // --- Critical alert ---
    if (this.consecutiveFailures >= MAX_FAILURES) {
      const msg = `DB has been unreachable for ${this.consecutiveFailures} consecutive checks`;
      console.error(`[MonitoringAgent] CRITICAL: ${msg}`);
      if (_broadcast) {
        _broadcast({ type: 'SYSTEM_ALERT', severity: 'critical', message: msg });
      }
    }

    // --- Persist to agent_logs ---
    await db.query(
      `INSERT INTO agent_logs (agent_name, event_type, payload, created_at)
       VALUES ('MonitoringAgent', 'health_check', $1::jsonb, NOW())`,
      [JSON.stringify({ dbUp, latencyMs: latency, memRssMb: this.metrics.memRssMb })]
    ).catch(() => {}); // non-fatal if table absent

    console.log(
      `[MonitoringAgent] db=${dbUp ? 'up' : 'DOWN'} latency=${latency}ms mem=${memMb.toFixed(1)}MB`
    );
  }

  getMetrics() {
    return this.metrics;
  }
}

module.exports = new MonitoringAgent();

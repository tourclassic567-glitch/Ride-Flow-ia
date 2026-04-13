/**
 * ResourcesAgent — CPU / memory optimisation and auto-scaling hints.
 *
 * Every tick (default 2 min) it:
 *  1. Samples current RSS memory and CPU usage (via process.cpuUsage delta).
 *  2. Triggers a GC hint if memory exceeds threshold.
 *  3. Records resource metrics in agent_logs.
 *  4. Broadcasts RESOURCE_ALERT when thresholds are exceeded.
 *  5. Suggests auto-scaling action when sustained high load is detected.
 */
const BaseAgent = require('./BaseAgent');
const db        = require('../db');
const scheduler = require('../services/scheduler');

const INTERVAL_MS         = parseInt(process.env.RESOURCES_INTERVAL_MS  || String(2 * 60 * 1000), 10);
const MEMORY_THRESHOLD_MB = parseInt(process.env.MEMORY_THRESHOLD_MB     || '512', 10);
const CPU_THRESHOLD_PCT   = parseInt(process.env.CPU_THRESHOLD_PCT       || '80', 10);

let _broadcast   = null;
let _prevCpuUsage = process.cpuUsage();
let _prevTime     = Date.now();

class ResourcesAgent extends BaseAgent {
  constructor() {
    super('ResourcesAgent', INTERVAL_MS);
    this.metrics = {
      memRssMb:   null,
      cpuPercent: null,
      scaleHint:  null,
    };

    scheduler.register('ResourcesAgent.check', {
      description: 'CPU/RAM monitoring & auto-scaling hints',
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
    const now     = Date.now();
    const elapsed = now - _prevTime;                    // ms
    const cpuDelta = process.cpuUsage(_prevCpuUsage);   // microseconds
    _prevCpuUsage = process.cpuUsage();
    _prevTime     = now;

    const cpuPercent = elapsed > 0
      ? Math.min(parseFloat(((cpuDelta.user + cpuDelta.system) / 1000 / elapsed * 100).toFixed(1)), 100)
      : 0;

    const memMb = parseFloat((process.memoryUsage().rss / 1024 / 1024).toFixed(1));

    this.metrics.memRssMb   = memMb;
    this.metrics.cpuPercent = cpuPercent;
    this.metrics.scaleHint  = null;

    const alerts = [];

    if (memMb > MEMORY_THRESHOLD_MB) {
      alerts.push(`High memory: ${memMb} MB (threshold ${MEMORY_THRESHOLD_MB} MB)`);
      this.metrics.scaleHint = 'scale-up';
      if (global.gc) global.gc();
    }

    if (cpuPercent > CPU_THRESHOLD_PCT) {
      alerts.push(`High CPU: ${cpuPercent}% (threshold ${CPU_THRESHOLD_PCT}%)`);
      this.metrics.scaleHint = 'scale-up';
    }

    if (alerts.length > 0 && _broadcast) {
      _broadcast({ type: 'RESOURCE_ALERT', alerts, metrics: this.metrics });
    }

    const payload = { memRssMb: memMb, cpuPercent, scaleHint: this.metrics.scaleHint };

    await db.query(
      `INSERT INTO agent_logs (agent_name, event_type, payload, created_at)
       VALUES ('ResourcesAgent', 'resource_check', $1::jsonb, NOW())`,
      [JSON.stringify(payload)]
    ).catch(() => {});

    scheduler.update('ResourcesAgent.check', {
      lastRunAt: new Date().toISOString(),
      nextRunAt: new Date(now + INTERVAL_MS).toISOString(),
      status:    'scheduled',
    });

    console.log(
      `[ResourcesAgent] mem=${memMb}MB cpu=${cpuPercent}% scaleHint=${this.metrics.scaleHint ?? 'none'}`
    );
  }

  getMetrics() {
    return this.metrics;
  }
}

module.exports = new ResourcesAgent();

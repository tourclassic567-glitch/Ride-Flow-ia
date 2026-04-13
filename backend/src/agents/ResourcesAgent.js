/**
 * ResourcesAgent — CPU / RAM optimisation, log cleanup, and auto-scaling hints.
 *
 * Every tick (default 5 min) it:
 *  1. Samples current process memory (RSS) and Node.js event-loop lag.
 *  2. Triggers a GC hint when memory exceeds HIGH_MEM_MB.
 *  3. Prunes stale agent_logs beyond RETENTION_DAYS.
 *  4. Emits an auto-scaling recommendation when sustained high load is detected.
 *  5. Persists the resource snapshot in agent_logs.
 */
const BaseAgent = require('./BaseAgent');
const db = require('../db');

const INTERVAL_MS   = parseInt(process.env.RESOURCES_INTERVAL_MS || String(5 * 60_000), 10);
const HIGH_MEM_MB   = parseInt(process.env.HIGH_MEM_MB           || '400', 10);
const RETENTION_DAYS = parseInt(process.env.RESOURCES_RETENTION_DAYS || '14', 10);

let _broadcast = null;

class ResourcesAgent extends BaseAgent {
  constructor() {
    super('ResourcesAgent', INTERVAL_MS);
    this.highMemCount = 0;
    this.lastSnapshot = null;
  }

  inject({ broadcast }) {
    _broadcast = broadcast;
  }

  async tick() {
    const mem     = process.memoryUsage();
    const rssMb   = parseFloat((mem.rss / 1024 / 1024).toFixed(1));
    const heapMb  = parseFloat((mem.heapUsed / 1024 / 1024).toFixed(1));

    // Event-loop lag (rough measurement)
    const lagMs = await this._measureLag();

    const snapshot = {
      timestamp: new Date().toISOString(),
      rssMb,
      heapMb,
      lagMs,
      gcHintTriggered: false,
      scalingRecommendation: null,
    };

    // GC hint
    if (rssMb > HIGH_MEM_MB) {
      this.highMemCount++;
      if (global.gc) {
        global.gc();
        snapshot.gcHintTriggered = true;
        console.log(`[ResourcesAgent] GC hint triggered (rss=${rssMb}MB)`);
      }
    } else {
      this.highMemCount = 0;
    }

    // Auto-scaling recommendation after 3 consecutive high-mem ticks
    if (this.highMemCount >= 3) {
      snapshot.scalingRecommendation = 'scale_up';
      if (_broadcast) {
        _broadcast({
          type: 'SCALING_RECOMMENDATION',
          recommendation: 'scale_up',
          reason: `RSS memory ${rssMb}MB exceeded ${HIGH_MEM_MB}MB for ${this.highMemCount} ticks`,
        });
      }
    }

    this.lastSnapshot = snapshot;

    // Prune old agent_logs
    await db.query(
      `DELETE FROM agent_logs WHERE created_at < NOW() - ($1 || ' days')::INTERVAL`,
      [RETENTION_DAYS]
    ).catch(() => {});

    await db.query(
      `INSERT INTO agent_logs (agent_name, event_type, payload, created_at)
       VALUES ('ResourcesAgent', 'resource_snapshot', $1::jsonb, NOW())`,
      [JSON.stringify(snapshot)]
    ).catch(() => {});

    console.log(
      `[ResourcesAgent] rss=${rssMb}MB heap=${heapMb}MB lag=${lagMs}ms highMemCount=${this.highMemCount}`
    );
  }

  /** Measures approx event-loop lag in ms */
  _measureLag() {
    return new Promise((resolve) => {
      const start = Date.now();
      setImmediate(() => resolve(Date.now() - start));
    });
  }

  getLastSnapshot() {
    return this.lastSnapshot;
  }
}

module.exports = new ResourcesAgent();

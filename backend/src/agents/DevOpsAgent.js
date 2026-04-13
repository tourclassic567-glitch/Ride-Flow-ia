/**
 * DevOpsAgent — automated deployment health checks and Hetzner Storage Box backups.
 *
 * Every tick (default 15 min) it:
 *  1. Validates that critical environment variables / services are present.
 *  2. Performs a self-health-check (process uptime, memory).
 *  3. Attempts an incremental backup to Hetzner Storage Box via rsync when
 *     HETZNER_BACKUP_USER, HETZNER_BACKUP_HOST, and BACKUP_DIR are set.
 *  4. Records results in agent_logs for audit trails.
 */
const BaseAgent = require('./BaseAgent');
const db = require('../db');
const { execFile } = require('child_process');

const INTERVAL_MS  = parseInt(process.env.DEVOPS_INTERVAL_MS  || String(15 * 60_000), 10);
const BACKUP_DIR   = process.env.BACKUP_DIR          || '/tmp/ride-flow-backups';
const HETZNER_USER = process.env.HETZNER_BACKUP_USER || '';
const HETZNER_HOST = process.env.HETZNER_BACKUP_HOST || '';

function rsync(src, dest) {
  return new Promise((resolve, reject) => {
    execFile(
      'rsync',
      ['-az', '--delete', src + '/', dest],
      { timeout: 120_000 },
      (err, stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve(stdout);
      }
    );
  });
}

class DevOpsAgent extends BaseAgent {
  constructor() {
    super('DevOpsAgent', INTERVAL_MS);
    this.lastHealth = null;
  }

  async tick() {
    const uptimeSec  = process.uptime();
    const memMb      = process.memoryUsage().rss / 1024 / 1024;
    const nodeVersion = process.version;

    const health = {
      timestamp:   new Date().toISOString(),
      uptimeSec:   Math.round(uptimeSec),
      memRssMb:    parseFloat(memMb.toFixed(1)),
      nodeVersion,
      dbConnected: false,
      hetznerBackup: null,
    };

    // DB ping
    const dbRes = await db.query('SELECT 1 AS ok').catch(() => null);
    health.dbConnected = !!(dbRes && dbRes.rows.length > 0);

    // Hetzner backup
    if (HETZNER_USER && HETZNER_HOST) {
      const dest = `${HETZNER_USER}@${HETZNER_HOST}:backup/ride-flow`;
      try {
        await rsync(BACKUP_DIR, dest);
        health.hetznerBackup = { status: 'ok', dest };
        console.log(`[DevOpsAgent] Hetzner backup → ${dest}`);
      } catch (err) {
        health.hetznerBackup = { status: 'failed', error: err.message };
        console.warn(`[DevOpsAgent] Hetzner backup failed: ${err.message}`);
      }
    } else {
      health.hetznerBackup = { status: 'not_configured' };
    }

    this.lastHealth = health;

    await db.query(
      `INSERT INTO agent_logs (agent_name, event_type, payload, created_at)
       VALUES ('DevOpsAgent', 'health_check', $1::jsonb, NOW())`,
      [JSON.stringify(health)]
    ).catch(() => {});

    console.log(
      `[DevOpsAgent] uptime=${health.uptimeSec}s mem=${health.memRssMb}MB db=${health.dbConnected}`
    );
  }

  getLastHealth() {
    return this.lastHealth;
  }
}

module.exports = new DevOpsAgent();

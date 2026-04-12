/**
 * BackupAgent — automated database backup and rotation.
 *
 * Every tick (default 6 h) it:
 *  1. Dumps the current row counts of all major tables as a lightweight snapshot.
 *  2. Stores the snapshot in agent_logs for audit trail.
 *  3. Prunes agent_logs older than RETENTION_DAYS (default 30).
 *
 * For full pg_dump support, set DATABASE_URL and BACKUP_DIR in env.
 * The agent shells out to pg_dump when DATABASE_URL is present and
 * pg_dump is available; otherwise it falls back to row-count snapshots.
 */
const BaseAgent = require('./BaseAgent');
const db = require('../db');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

const BACKUP_DIR = process.env.BACKUP_DIR || '/tmp/ride-flow-backups';
const RETENTION_DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);
const INTERVAL_MS = parseInt(process.env.BACKUP_INTERVAL_MS || String(6 * 60 * 60 * 1000), 10);

function ensureDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
}

function pgDump(connectionString, outFile) {
  return new Promise((resolve, reject) => {
    execFile('pg_dump', ['--format=custom', '--file', outFile, connectionString], (err) => {
      if (err) reject(err);
      else resolve(outFile);
    });
  });
}

class BackupAgent extends BaseAgent {
  constructor() {
    super('BackupAgent', INTERVAL_MS);
    this.lastBackupFile = null;
  }

  async tick() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // --- Attempt full pg_dump if credentials available ---
    if (process.env.DATABASE_URL) {
      ensureDir(BACKUP_DIR);
      const outFile = path.join(BACKUP_DIR, `backup-${timestamp}.dump`);
      try {
        await pgDump(process.env.DATABASE_URL, outFile);
        this.lastBackupFile = outFile;
        console.log(`[BackupAgent] pg_dump → ${outFile}`);
      } catch (err) {
        console.warn(`[BackupAgent] pg_dump unavailable, falling back to snapshot: ${err.message}`);
        await this._snapshotBackup(timestamp);
      }
    } else {
      await this._snapshotBackup(timestamp);
    }

    // --- Prune old logs ---
    await db.query(
      `DELETE FROM agent_logs WHERE created_at < NOW() - ($1 || ' days')::INTERVAL`,
      [RETENTION_DAYS]
    ).catch(() => {});

    console.log(`[BackupAgent] Pruned agent_logs older than ${RETENTION_DAYS} days`);
  }

  async _snapshotBackup(timestamp) {
    const tables = ['users', 'drivers', 'rides', 'payments', 'demand_metrics'];
    const snapshot = {};

    for (const table of tables) {
      const res = await db.query(`SELECT COUNT(*) AS cnt FROM ${table}`).catch(() => null);
      snapshot[table] = res ? parseInt(res.rows[0].cnt, 10) : 'unavailable';
    }

    await db.query(
      `INSERT INTO agent_logs (agent_name, event_type, payload, created_at)
       VALUES ('BackupAgent', 'snapshot', $1::jsonb, NOW())`,
      [JSON.stringify({ timestamp, snapshot })]
    ).catch(() => {});

    console.log(`[BackupAgent] snapshot recorded:`, snapshot);
  }
}

module.exports = new BackupAgent();

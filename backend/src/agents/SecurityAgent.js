/**
 * SecurityAgent — autonomous intrusion detection, dynamic IP blocking, and security audits.
 *
 * Every tick (default 5 min) it:
 *  1. Counts failed auth attempts per IP in the last window (default 15 min).
 *  2. Auto-blocks IPs that exceed BLOCK_THRESHOLD (default 10) failures.
 *  3. Expires old blocks (default 24 h auto-expiry).
 *  4. Runs a lightweight security audit (checks for stale API keys, unusual activity).
 *  5. Persists events in security_events and agent_logs.
 *  6. Broadcasts SECURITY_ALERT via WebSocket when new blocks are issued.
 */
const BaseAgent   = require('./BaseAgent');
const db          = require('../db');
const { blockIpCache, unblockIpCache } = require('../middleware/ipBlock');

const INTERVAL_MS       = parseInt(process.env.SECURITY_INTERVAL_MS   || String(5 * 60 * 1000), 10);
const BLOCK_THRESHOLD   = parseInt(process.env.SECURITY_BLOCK_THRESHOLD || '10', 10);
const WINDOW_MINUTES    = parseInt(process.env.SECURITY_WINDOW_MINUTES  || '15', 10);
const BLOCK_HOURS       = parseInt(process.env.SECURITY_BLOCK_HOURS     || '24', 10);

let _broadcast = null;

class SecurityAgent extends BaseAgent {
  constructor() {
    super('SecurityAgent', INTERVAL_MS);
    this.lastAudit = null;
  }

  inject({ broadcast }) {
    _broadcast = broadcast;
  }

  async tick() {
    await this._expireBlocks();
    const newlyBlocked = await this._detectAndBlock();
    const audit        = await this._runAudit();

    this.lastAudit = { ...audit, newlyBlockedCount: newlyBlocked.length, checkedAt: new Date().toISOString() };

    await db.query(
      `INSERT INTO agent_logs (agent_name, event_type, payload, created_at)
       VALUES ('SecurityAgent', 'security_tick', $1::jsonb, NOW())`,
      [JSON.stringify(this.lastAudit)]
    ).catch(() => {});

    if (newlyBlocked.length > 0 && _broadcast) {
      _broadcast({
        type:    'SECURITY_ALERT',
        severity: 'warning',
        message: `Blocked ${newlyBlocked.length} IP(s) for exceeding ${BLOCK_THRESHOLD} failed attempts`,
        ips:     newlyBlocked,
      });
    }

    console.log(
      `[SecurityAgent] blocked=${newlyBlocked.length} audit_issues=${audit.issues.length}`
    );
  }

  /** Remove expired blocks from DB and in-process cache */
  async _expireBlocks() {
    const res = await db.query(
      `DELETE FROM blocked_ips WHERE expires_at IS NOT NULL AND expires_at <= NOW() RETURNING ip`
    ).catch(() => null);

    for (const row of res?.rows ?? []) {
      unblockIpCache(row.ip);
    }
  }

  /** Detect IPs with too many failures and block them */
  async _detectAndBlock() {
    // Aggregate failed auth events in the rolling window
    const failRes = await db.query(
      `SELECT ip, COUNT(*) AS failures
       FROM security_events
       WHERE event_type = 'auth_failure'
         AND created_at > NOW() - ($1 || ' minutes')::INTERVAL
         AND ip IS NOT NULL
       GROUP BY ip
       HAVING COUNT(*) >= $2`,
      [WINDOW_MINUTES, BLOCK_THRESHOLD]
    ).catch(() => null);

    const ipsToBlock = (failRes?.rows ?? []).map((r) => r.ip);

    for (const ip of ipsToBlock) {
      // Upsert block with expiry
      await db.query(
        `INSERT INTO blocked_ips (ip, reason, blocked_at, expires_at)
         VALUES ($1, $2, NOW(), NOW() + ($3 || ' hours')::INTERVAL)
         ON CONFLICT (ip) DO UPDATE
           SET reason     = EXCLUDED.reason,
               blocked_at = EXCLUDED.blocked_at,
               expires_at = EXCLUDED.expires_at`,
        [ip, `Exceeded ${BLOCK_THRESHOLD} failed auth attempts in ${WINDOW_MINUTES} min`, BLOCK_HOURS]
      ).catch(() => {});

      // Update in-process cache immediately
      blockIpCache(ip);

      await db.query(
        `INSERT INTO security_events (event_type, ip, payload, created_at)
         VALUES ('ip_blocked', $1, $2::jsonb, NOW())`,
        [ip, JSON.stringify({ threshold: BLOCK_THRESHOLD, window_minutes: WINDOW_MINUTES })]
      ).catch(() => {});
    }

    return ipsToBlock;
  }

  /** Lightweight security audit */
  async _runAudit() {
    const issues = [];

    // Check for inactive API keys that still have recent usage (potential hijack)
    const staleKeyRes = await db.query(
      `SELECT id, name FROM api_keys
       WHERE active = FALSE AND last_used > NOW() - INTERVAL '1 hour'`
    ).catch(() => null);

    for (const row of staleKeyRes?.rows ?? []) {
      issues.push({ type: 'stale_api_key_used', keyId: row.id, name: row.name });
    }

    // Check for an unusual spike in security events (> 100 in last hour)
    const spikeRes = await db.query(
      `SELECT COUNT(*) AS cnt FROM security_events
       WHERE created_at > NOW() - INTERVAL '1 hour'`
    ).catch(() => null);

    const eventCount = spikeRes ? parseInt(spikeRes.rows[0].cnt, 10) : 0;
    if (eventCount > 100) {
      issues.push({ type: 'high_security_event_volume', count: eventCount });
    }

    // Number of currently blocked IPs
    const blockedRes = await db.query(
      `SELECT COUNT(*) AS cnt FROM blocked_ips
       WHERE expires_at IS NULL OR expires_at > NOW()`
    ).catch(() => null);

    const blockedIpCount = blockedRes ? parseInt(blockedRes.rows[0].cnt, 10) : 0;

    if (issues.length > 0 && _broadcast) {
      _broadcast({ type: 'SECURITY_AUDIT', issues, blockedIpCount });
    }

    return { issues, blockedIpCount, eventVolume1h: eventCount };
  }

  getLastAudit() {
    return this.lastAudit;
  }
}

module.exports = new SecurityAgent();

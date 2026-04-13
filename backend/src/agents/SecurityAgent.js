/**
 * SecurityAgent — dynamic security monitoring and intrusion detection.
 *
 * Every tick (default 5 min) it:
 *  1. Scans agent_logs for suspicious events (repeated auth failures, anomalies).
 *  2. Maintains a list of blocked IPs detected at the application level.
 *  3. Logs an audit record in agent_logs for compliance trails.
 *  4. Broadcasts SECURITY_ALERT via WebSocket when threats are detected.
 *
 * Production hardening notes (outside Node.js scope):
 *  - UFW: configure via `ufw allow <port>` on the host.
 *  - Fail2Ban: protects SSH against brute-force independently.
 *  - Certbot/Let's Encrypt: renews TLS certificates automatically.
 */
const BaseAgent  = require('./BaseAgent');
const db         = require('../db');
const scheduler  = require('../services/scheduler');

const INTERVAL_MS    = parseInt(process.env.SECURITY_INTERVAL_MS || String(5 * 60 * 1000), 10);
const THREAT_WINDOW  = parseInt(process.env.SECURITY_THREAT_WINDOW_MINUTES || '60', 10);

let _broadcast = null;

class SecurityAgent extends BaseAgent {
  constructor() {
    super('SecurityAgent', INTERVAL_MS);
    this.blockedIPs    = new Set();
    this.lastAuditAt   = null;
    this.threatCount   = 0;

    scheduler.register('SecurityAgent.audit', {
      description: 'Intrusion detection & security audit',
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
    const now = new Date();

    // --- Scan for repeated auth-failure patterns in agent_logs ---
    const suspiciousRes = await db.query(
      `SELECT payload->>'ip' AS ip, COUNT(*) AS attempts
       FROM agent_logs
       WHERE event_type = 'auth_failure'
         AND created_at > NOW() - ($1 || ' minutes')::INTERVAL
       GROUP BY payload->>'ip'
       HAVING COUNT(*) >= 10`,
      [THREAT_WINDOW]
    ).catch(() => null);

    const newThreats = [];
    if (suspiciousRes && suspiciousRes.rows.length > 0) {
      for (const row of suspiciousRes.rows) {
        if (row.ip && !this.blockedIPs.has(row.ip)) {
          this.blockedIPs.add(row.ip);
          newThreats.push({ ip: row.ip, attempts: parseInt(row.attempts, 10) });
          console.warn(`[SecurityAgent] Blocking IP: ${row.ip} (${row.attempts} auth failures)`);
        }
      }
    }

    this.threatCount += newThreats.length;

    if (newThreats.length > 0 && _broadcast) {
      _broadcast({
        type:    'SECURITY_ALERT',
        threats: newThreats,
        message: `${newThreats.length} IP(s) blocked after repeated auth failures`,
      });
    }

    // --- Persist audit record ---
    const auditPayload = {
      blockedIPCount: this.blockedIPs.size,
      newThreats,
      threatWindow:   THREAT_WINDOW,
      auditedAt:      now.toISOString(),
    };

    await db.query(
      `INSERT INTO agent_logs (agent_name, event_type, payload, created_at)
       VALUES ('SecurityAgent', 'security_audit', $1::jsonb, NOW())`,
      [JSON.stringify(auditPayload)]
    ).catch(() => {});

    this.lastAuditAt = now.toISOString();

    scheduler.update('SecurityAgent.audit', {
      lastRunAt: now.toISOString(),
      nextRunAt: new Date(Date.now() + INTERVAL_MS).toISOString(),
      status:    'scheduled',
    });

    console.log(
      `[SecurityAgent] blocked_ips=${this.blockedIPs.size} new_threats=${newThreats.length}`
    );
  }

  getSecurityStatus() {
    return {
      blockedIPCount: this.blockedIPs.size,
      totalThreatsDetected: this.threatCount,
      lastAuditAt: this.lastAuditAt,
    };
  }
}

module.exports = new SecurityAgent();

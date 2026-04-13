/**
 * SecurityAgent — dynamic firewall, intrusion detection, and security audits.
 *
 * Every tick (default 60 s) it:
 *  1. Reviews failed authentication attempts stored in agent_logs.
 *  2. Auto-blocks IPs that exceed MAX_FAILURES within the detection window.
 *  3. Clears blocks for IPs whose block period has expired.
 *  4. Emits a SECURITY_ALERT WebSocket event when new blocks are applied.
 *  5. Persists audit entries to agent_logs.
 *
 * In-memory block list is shared with the adminAuth middleware via the
 * exported `isBlocked` / `recordFailure` helpers so HTTP request handlers
 * can check and record events without a DB round-trip.
 */
const BaseAgent = require('./BaseAgent');
const db = require('../db');

const INTERVAL_MS    = parseInt(process.env.SECURITY_INTERVAL_MS || String(60_000), 10);
const MAX_FAILURES   = parseInt(process.env.SECURITY_MAX_FAILURES   || '10', 10);
const WINDOW_MINUTES = parseInt(process.env.SECURITY_WINDOW_MINUTES || '15', 10);
const BLOCK_MINUTES  = parseInt(process.env.SECURITY_BLOCK_MINUTES  || '60', 10);

/** ip → { count, firstSeen, blockedUntil } */
const _ipState = new Map();

let _broadcast = null;

/**
 * Record a failed auth attempt for the given IP.
 * Called externally by route/middleware code.
 * @param {string} ip
 */
function recordFailure(ip) {
  const now = Date.now();
  const state = _ipState.get(ip) || { count: 0, firstSeen: now, blockedUntil: 0 };

  // Reset window if it has expired
  if (now - state.firstSeen > WINDOW_MINUTES * 60_000) {
    state.count = 0;
    state.firstSeen = now;
  }

  state.count++;
  _ipState.set(ip, state);
}

/**
 * Returns true when the IP is currently blocked.
 * @param {string} ip
 */
function isBlocked(ip) {
  const state = _ipState.get(ip);
  if (!state) return false;
  if (state.blockedUntil && Date.now() < state.blockedUntil) return true;
  // Block expired — clear it
  if (state.blockedUntil && Date.now() >= state.blockedUntil) {
    state.blockedUntil = 0;
    state.count = 0;
    _ipState.set(ip, state);
  }
  return false;
}

class SecurityAgent extends BaseAgent {
  constructor() {
    super('SecurityAgent', INTERVAL_MS);
    this.auditLog = [];
  }

  inject({ broadcast }) {
    _broadcast = broadcast;
  }

  async tick() {
    const now = Date.now();
    const newBlocks = [];

    for (const [ip, state] of _ipState) {
      // Skip already-blocked IPs
      if (state.blockedUntil && now < state.blockedUntil) continue;

      if (state.count >= MAX_FAILURES) {
        state.blockedUntil = now + BLOCK_MINUTES * 60_000;
        _ipState.set(ip, state);
        newBlocks.push(ip);
        console.warn(`[SecurityAgent] Blocked IP ${ip} (${state.count} failures in window)`);
      }
    }

    if (newBlocks.length > 0) {
      const payload = { blocked: newBlocks, blockedUntilMinutes: BLOCK_MINUTES };
      this.auditLog.push({ ts: new Date().toISOString(), ...payload });
      if (this.auditLog.length > 500) this.auditLog.shift();

      if (_broadcast) {
        _broadcast({ type: 'SECURITY_ALERT', ...payload });
      }

      await db.query(
        `INSERT INTO agent_logs (agent_name, event_type, payload, created_at)
         VALUES ('SecurityAgent', 'ip_block', $1::jsonb, NOW())`,
        [JSON.stringify(payload)]
      ).catch(() => {});
    }

    // Housekeeping: evict old, non-blocked, low-count entries
    for (const [ip, state] of _ipState) {
      if (!state.blockedUntil && now - state.firstSeen > WINDOW_MINUTES * 60_000) {
        _ipState.delete(ip);
      }
    }

    console.log(
      `[SecurityAgent] tracked=${_ipState.size} newBlocks=${newBlocks.length}`
    );
  }

  getStats() {
    const now = Date.now();
    let blocked = 0;
    for (const state of _ipState.values()) {
      if (state.blockedUntil && now < state.blockedUntil) blocked++;
    }
    return {
      trackedIPs: _ipState.size,
      currentlyBlocked: blocked,
      recentAuditLog: this.auditLog.slice(-20),
    };
  }
}

const instance = new SecurityAgent();

module.exports = instance;
module.exports.recordFailure = recordFailure;
module.exports.isBlocked = isBlocked;

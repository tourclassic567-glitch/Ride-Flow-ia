/**
 * ipBlock middleware — rejects requests from IPs that SecurityAgent has blocked.
 *
 * Blocked IPs are stored in the `blocked_ips` DB table.  A lightweight
 * in-process cache (TTL = 60 s) avoids a DB hit on every request.
 */
const db = require('../db');

const CACHE_TTL_MS = 60_000; // 1 minute

let _cache = new Set();
let _cacheBuiltAt = 0;

async function _refreshCache() {
  try {
    const res = await db.query(
      `SELECT ip FROM blocked_ips
       WHERE expires_at IS NULL OR expires_at > NOW()`
    );
    _cache = new Set((res?.rows ?? []).map((r) => r.ip));
    _cacheBuiltAt = Date.now();
  } catch {
    // If DB is unavailable keep the previous cache
  }
}

/** Call this from SecurityAgent to immediately add an IP to the cache. */
function blockIpCache(ip) {
  _cache.add(ip);
}

/** Remove an IP from the local cache (e.g. after it expires). */
function unblockIpCache(ip) {
  _cache.delete(ip);
}

async function ipBlockMiddleware(req, res, next) {
  // Refresh cache if stale
  if (Date.now() - _cacheBuiltAt > CACHE_TTL_MS) {
    await _refreshCache();
  }

  const ip = req.ip || req.socket?.remoteAddress || '';
  if (_cache.has(ip)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
}

module.exports = { ipBlockMiddleware, blockIpCache, unblockIpCache };

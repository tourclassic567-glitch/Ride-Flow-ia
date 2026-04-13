const crypto = require('crypto');

// In-memory failure tracker: ip -> { count, blockedUntil }
const failureMap = new Map();
const MAX_FAILURES = 10;
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Middleware: validates the X-Admin-Key header using constant-time comparison
 * to prevent timing attacks. Automatically blocks an IP after MAX_FAILURES
 * consecutive failed attempts.
 */
function adminAuth(req, res, next) {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();

  // Check if IP is currently blocked
  const record = failureMap.get(ip);
  if (record && record.blockedUntil && now < record.blockedUntil) {
    const remainingMs = record.blockedUntil - now;
    return res.status(429).json({
      error: 'Too many failed authentication attempts. Try again later.',
      retryAfterSeconds: Math.ceil(remainingMs / 1000),
    });
  }

  const providedKey = req.headers['x-admin-key'] || '';
  const expectedKey = process.env.ADMIN_API_KEY || '';

  // Constant-time comparison (safe even when keys have different lengths)
  let valid = false;
  try {
    if (expectedKey.length > 0 && providedKey.length > 0) {
      const a = Buffer.from(providedKey.padEnd(expectedKey.length, '\0'), 'utf8');
      const b = Buffer.from(expectedKey.padEnd(providedKey.length, '\0'), 'utf8');
      // Use the longer buffer length so both comparisons see equal-length buffers
      const len = Math.max(a.length, b.length);
      const aBuf = Buffer.alloc(len);
      const bBuf = Buffer.alloc(len);
      a.copy(aBuf);
      b.copy(bBuf);
      valid = crypto.timingSafeEqual(aBuf, bBuf) && providedKey === expectedKey;
    }
  } catch (_) {
    valid = false;
  }

  if (!valid) {
    const failures = record ? record.count + 1 : 1;
    const blockedUntil = failures >= MAX_FAILURES ? now + BLOCK_DURATION_MS : null;
    failureMap.set(ip, { count: failures, blockedUntil });

    if (blockedUntil) {
      console.warn(`[adminAuth] IP ${ip} blocked after ${failures} failed attempts`);
      return res.status(429).json({
        error: 'Too many failed authentication attempts. IP has been blocked.',
        retryAfterSeconds: Math.ceil(BLOCK_DURATION_MS / 1000),
      });
    }

    return res.status(401).json({ error: 'Unauthorized. Valid X-Admin-Key required.' });
  }

  // Successful auth – clear failure record
  failureMap.delete(ip);
  next();
}

module.exports = adminAuth;

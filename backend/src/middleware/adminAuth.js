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

  // Constant-time comparison (safe against timing attacks).
  // Length inequality leaks information, so we always run timingSafeEqual
  // on equal-length buffers and additionally require an exact length match.
  let valid = false;
  try {
    if (expectedKey.length > 0) {
      const aBuf = Buffer.from(providedKey, 'utf8');
      const bBuf = Buffer.from(expectedKey, 'utf8');
      // Pad both to the longer length so timingSafeEqual receives equal-size buffers
      const len = Math.max(aBuf.length, bBuf.length);
      const aPad = Buffer.alloc(len);
      const bPad = Buffer.alloc(len);
      aBuf.copy(aPad);
      bBuf.copy(bPad);
      // timingSafeEqual ensures no timing leak; length check ensures correctness
      valid = crypto.timingSafeEqual(aPad, bPad) && aBuf.length === bBuf.length;
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

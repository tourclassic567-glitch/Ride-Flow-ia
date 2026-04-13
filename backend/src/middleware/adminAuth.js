/**
 * adminAuth — middleware that validates the X-Admin-Key header.
 *
 * Uses crypto.timingSafeEqual to prevent timing-based enumeration of the key.
 * Records failed attempts via SecurityAgent so the IP can be auto-blocked
 * after MAX_FAILURES within the detection window.
 */
const crypto = require('crypto');
const { recordFailure, isBlocked } = require('../agents/SecurityAgent');

const ADMIN_KEY = process.env.ADMIN_KEY || '';

/**
 * Constant-time comparison of two strings.
 * Returns false if either is empty or lengths differ (prevents early exit).
 */
function safeCompare(a, b) {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Compare against a dummy buffer to keep timing consistent
    crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Extract the requesting IP, honouring X-Forwarded-For when behind a proxy.
 * Returns null when the IP cannot be determined.
 */
function getIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim() || null;
  return req.socket?.remoteAddress || null;
}

module.exports = function adminAuth(req, res, next) {
  const ip = getIP(req);

  if (!ip) {
    return res.status(403).json({ error: 'Access denied – unable to determine client IP' });
  }

  if (isBlocked(ip)) {
    return res.status(403).json({ error: 'Access denied – IP temporarily blocked' });
  }

  if (!ADMIN_KEY) {
    // No admin key configured → block all admin access
    return res.status(503).json({ error: 'Admin access not configured' });
  }

  const provided = req.headers['x-admin-key'] || '';

  if (!safeCompare(provided, ADMIN_KEY)) {
    recordFailure(ip);
    return res.status(401).json({ error: 'Invalid or missing X-Admin-Key' });
  }

  next();
};

/**
 * apiKeyAuth middleware — constant-time API key validation (anti-timing attacks).
 *
 * Clients pass their key in the `X-Api-Key` header.
 * The middleware computes HMAC-SHA256 (keyed with API_KEY_SECRET) of the supplied
 * key and checks it against the `api_keys` table using crypto.timingSafeEqual so
 * that response time does not leak information about the stored hash.
 *
 * API keys are random high-entropy tokens, not passwords.  HMAC-SHA256 with a
 * server-side secret is the appropriate primitive for this use case.
 *
 * Usage:
 *   router.use(apiKeyAuth);          // protect an entire router
 *   router.get('/protected', apiKeyAuth, handler);  // protect one route
 *
 * To skip (e.g. during local development) set REQUIRE_API_KEY=false in env.
 */
const crypto = require('crypto');
const db = require('../db');

const REQUIRE_API_KEY = process.env.REQUIRE_API_KEY !== 'false';
// Server-side secret used in HMAC so hashes are unguessable without both
// the raw key and the secret.  Falls back to a deterministic dev value if
// unset (non-production only).
const API_KEY_SECRET = process.env.API_KEY_SECRET || 'dev-only-secret-change-in-production';

function hmacHex(value) {
  return crypto.createHmac('sha256', API_KEY_SECRET).update(value).digest('hex');
}

/**
 * Constant-time compare of two hex strings (same length guaranteed by SHA-256 output).
 */
function safeEqual(a, b) {
  try {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

async function apiKeyAuth(req, res, next) {
  if (!REQUIRE_API_KEY) return next();

  const rawKey = req.headers['x-api-key'];
  if (!rawKey) {
    return res.status(401).json({ error: 'Missing X-Api-Key header' });
  }

  const supplied = hmacHex(rawKey);

  let valid = false;
  try {
    const result = await db.query(
      `SELECT id, key_hash FROM api_keys WHERE active = TRUE`
    );

    for (const row of result?.rows ?? []) {
      if (safeEqual(supplied, row.key_hash)) {
        valid = true;
        // Update last_used non-blockingly
        db.query(`UPDATE api_keys SET last_used = NOW() WHERE id = $1`, [row.id]).catch(() => {});
        break;
      }
    }
  } catch {
    return res.status(503).json({ error: 'Authentication service unavailable' });
  }

  if (!valid) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
}

module.exports = apiKeyAuth;

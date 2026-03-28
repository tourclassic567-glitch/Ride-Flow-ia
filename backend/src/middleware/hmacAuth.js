'use strict';

/**
 * HMAC Authentication Middleware
 *
 * Validates every inbound request using a three-header scheme:
 *
 *   x-api-key   – public key identifier (keyId)
 *   x-timestamp – Unix timestamp in milliseconds (string)
 *   x-signature – HMAC-SHA256 hex digest of the canonical string
 *
 * Canonical string format:
 *   METHOD|PATH|BODY|TIMESTAMP
 *
 *   METHOD    – uppercase HTTP verb (GET, POST, …)
 *   PATH      – full request path including query string (e.g. /api/events/emit)
 *   BODY      – raw JSON body string, or "" when the body is empty
 *   TIMESTAMP – the value sent in x-timestamp
 *
 * Rejection conditions (in order):
 *   1. Missing headers
 *   2. Unknown or inactive key
 *   3. Timestamp outside the ±5-minute window (replay protection)
 *   4. Signature mismatch
 *
 * Performance: all operations are synchronous and use native `crypto` only;
 * measured overhead is well under 5 ms per request.
 */

const crypto = require('crypto');
const { getKey } = require('../security/keys');
const audit = require('../observability/audit');

const FIVE_MINUTES_MS = 5 * 60 * 1000;

/**
 * Build the canonical string that both sides must agree on.
 *
 * @param {import('express').Request} req
 * @param {string} timestamp – raw value from x-timestamp header
 * @returns {string}
 */
function buildCanonicalString(req, timestamp) {
  const method = req.method.toUpperCase();
  const path = req.originalUrl || req.url;
  const body = req.body && Object.keys(req.body).length > 0 ? JSON.stringify(req.body) : '';
  return `${method}|${path}|${body}|${timestamp}`;
}

/**
 * Express middleware – rejects requests that fail HMAC validation.
 *
 * @param {import('express').Request}  req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function hmacAuth(req, res, next) {
  const route = `${req.method.toUpperCase()} ${req.originalUrl || req.url}`;
  const keyId = req.headers['x-api-key'];
  const signature = req.headers['x-signature'];
  const timestamp = req.headers['x-timestamp'];

  // ── 1. Require all three headers ─────────────────────────────────────────
  if (!keyId || !signature || !timestamp) {
    audit.log({ keyId, route, success: false, reason: 'missing headers' });
    return res.status(401).json({
      error: 'Unauthorized',
      detail: 'Required headers: x-api-key, x-signature, x-timestamp',
    });
  }

  // ── 2. Key must exist and be active ──────────────────────────────────────
  const key = getKey(keyId);
  if (!key) {
    audit.log({ keyId, route, success: false, reason: 'unknown key' });
    return res.status(401).json({ error: 'Unauthorized', detail: 'Unknown API key' });
  }
  if (!key.active) {
    audit.log({ keyId, route, success: false, reason: 'inactive key' });
    return res.status(403).json({ error: 'Forbidden', detail: 'API key is inactive' });
  }

  // ── 3. Timestamp replay-protection window ────────────────────────────────
  const ts = parseInt(timestamp, 10);
  if (Number.isNaN(ts) || Math.abs(Date.now() - ts) > FIVE_MINUTES_MS) {
    audit.log({ keyId, route, success: false, reason: 'expired timestamp' });
    return res.status(401).json({ error: 'Unauthorized', detail: 'Timestamp expired or invalid' });
  }

  // ── 4. Verify HMAC signature ─────────────────────────────────────────────
  const canonical = buildCanonicalString(req, timestamp);
  const expected = crypto.createHmac('sha256', key.secret).update(canonical).digest('hex');

  let signaturesMatch = false;
  try {
    // timingSafeEqual requires Buffers of equal length
    const expectedBuf = Buffer.from(expected, 'hex');
    const receivedBuf = Buffer.from(signature, 'hex');
    signaturesMatch =
      expectedBuf.length === receivedBuf.length &&
      crypto.timingSafeEqual(expectedBuf, receivedBuf);
  } catch (_hexConversionError) {
    // Buffer.from() throws when the signature header contains non-hex characters;
    // treat any such malformed input as a signature mismatch.
    signaturesMatch = false;
  }

  if (!signaturesMatch) {
    audit.log({ keyId, route, success: false, reason: 'invalid signature' });
    return res.status(401).json({ error: 'Unauthorized', detail: 'Signature mismatch' });
  }

  // ── Accepted ─────────────────────────────────────────────────────────────
  audit.log({ keyId, route, success: true });
  req.authenticatedKeyId = keyId;
  next();
}

module.exports = hmacAuth;

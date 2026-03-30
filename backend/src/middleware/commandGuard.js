// /src/middleware/commandGuard.js

const crypto = require('crypto');

const ALLOWED_TYPES = ["ride", "cargo", "delivery", "system"];

/**
 * Compare two strings in constant time to prevent timing attacks on the
 * API key comparison.  Returns true only when both strings are identical.
 */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) {
    // Still run the comparison to avoid leaking length information via timing,
    // but return false afterwards.
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function commandGuard(req, res, next) {
  try {
    const token = req.headers["x-api-key"];
    const expected = process.env.MIKE_API_KEY || '';

    // --- AUTH (timing-safe comparison to prevent timing attacks)
    if (!token || !safeEqual(token, expected)) {
      return res.status(401).json({ error: "unauthorized" });
    }

    const { id, type, command, payload } = req.body;

    // --- VALIDACIÓN ESTRUCTURAL
    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "invalid id" });
    }

    if (!type || !ALLOWED_TYPES.includes(type)) {
      return res.status(400).json({ error: "invalid type" });
    }

    if (payload && typeof payload !== "object") {
      return res.status(400).json({ error: "invalid payload" });
    }

    // --- NORMALIZACIÓN (VARIABLES MIKE)
    req.mike = {
      session_id: id,
      service_type: type,
      action: command || "default",
      execution_data: payload || {},
      timestamp: Date.now(),
    };

    next();
  } catch (err) {
    return res.status(500).json({ error: "middleware failure" });
  }
}

module.exports = commandGuard;

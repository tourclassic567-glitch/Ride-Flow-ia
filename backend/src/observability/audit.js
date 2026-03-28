'use strict';

/**
 * Audit Logger
 *
 * Records every HMAC authentication attempt with:
 *   keyId     – the API key identifier (or "<missing>" when no key was supplied)
 *   route     – the HTTP method + path
 *   success   – true when the request was accepted, false otherwise
 *   reason    – human-readable rejection reason (only present on failure)
 *   timestamp – ISO-8601 timestamp
 *
 * Emits structured JSON lines to stdout so they can be collected by any
 * log-aggregation pipeline without additional libraries.
 */

/**
 * Write one audit entry.
 *
 * @param {object}  entry
 * @param {string}  entry.keyId    – API key identifier
 * @param {string}  entry.route    – e.g. "POST /api/events/emit"
 * @param {boolean} entry.success  – authentication outcome
 * @param {string}  [entry.reason] – rejection reason (only on failure)
 */
function log(entry) {
  const record = {
    audit: true,
    keyId: entry.keyId || '<missing>',
    route: entry.route,
    success: entry.success,
    timestamp: new Date().toISOString(),
  };
  if (!entry.success && entry.reason) {
    record.reason = entry.reason;
  }
  console.log(JSON.stringify(record));
}

module.exports = { log };

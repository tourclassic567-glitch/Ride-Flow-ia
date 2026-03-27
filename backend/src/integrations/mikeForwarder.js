'use strict';

/**
 * MIKE Forwarder
 *
 * Forwards every event and every command to the external MIKE system
 * in a non-blocking, error-safe manner.
 *
 * Configuration (environment variable):
 *   MIKE_URL – full URL of the MIKE ingestion endpoint
 *              e.g. https://mike.example.com/ingest
 *
 * If MIKE_URL is not set the forwarder is silently disabled; no errors
 * are raised and the rest of the system continues unaffected.
 *
 * Payload sent to MIKE (JSON POST):
 *   {
 *     source:    "ride-flow",
 *     type:      "event" | "command" | "error",
 *     data:      { ... },       // original payload
 *     timestamp: "<ISO-8601>"
 *   }
 *
 * Execution model:
 *   - Each forward call schedules the HTTP request via setImmediate
 *     so it never delays the caller's HTTP response.
 *   - All errors (network, DNS, timeout, bad status) are caught and
 *     logged; they never propagate to the caller.
 */

const http = require('http');
const https = require('https');

const MIKE_URL = process.env.MIKE_URL || '';

/**
 * Send a fire-and-forget POST to MIKE.
 *
 * @param {string} type  – "event" | "command" | "error"
 * @param {object} data  – payload to forward
 */
function forward(type, data) {
  if (!MIKE_URL) {
    // MIKE not configured – skip silently
    return;
  }

  // Defer the network call so it never blocks the caller
  setImmediate(() => {
    try {
      const body = JSON.stringify({
        source: 'ride-flow',
        type,
        data,
        timestamp: new Date().toISOString(),
      });

      const url = new URL(MIKE_URL);
      const client = url.protocol === 'https:' ? https : http;
      const port = url.port ? parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : 80);

      const req = client.request(
        {
          hostname: url.hostname,
          port,
          path: url.pathname + (url.search || ''),
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          // Drain response to free the socket
          res.resume();
          console.log(`[mike] forwarded type="${type}" status=${res.statusCode}`);
        }
      );

      req.on('error', (err) => {
        console.error(`[mike] forward error type="${type}":`, err.message);
      });

      // Set a 5-second timeout so a slow MIKE never keeps the socket open
      req.setTimeout(5000, () => {
        console.error(`[mike] forward timeout type="${type}"`);
        req.destroy();
      });

      req.write(body);
      req.end();
    } catch (err) {
      console.error(`[mike] forward failed type="${type}":`, err.message);
    }
  });
}

module.exports = { forward };

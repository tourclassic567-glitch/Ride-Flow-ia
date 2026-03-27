'use strict';

/**
 * MIKE Forwarder
 *
 * Forwards every event and every command to the external MIKE system.
 * Signs every outbound payload with HMAC-SHA256 using MIKE_SECRET and
 * verifies the signed ACK returned by MIKE.
 *
 * Configuration (environment variables):
 *   MIKE_ENDPOINT – full URL of the MIKE ingestion endpoint
 *   MIKE_SECRET   – shared secret used to sign payloads and verify ACKs
 *
 * If MIKE_ENDPOINT is not set the forwarder is silently disabled; no errors
 * are raised and the rest of the system continues unaffected.
 *
 * Execution model:
 *   Callers wrap sendToMike in setImmediate so it never delays the HTTP
 *   response. All errors (network, ACK validation, etc.) are caught and
 *   logged; they never propagate to the caller.
 */

const crypto = require('crypto');
const axios = require('axios');

const MIKE_ENDPOINT = process.env.MIKE_ENDPOINT;
const MIKE_SECRET = process.env.MIKE_SECRET;

function sign(payload) {
  return crypto
    .createHmac('sha256', MIKE_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');
}

function verifyAck(ack) {
  if (!ack || !ack.payload || !ack.signature) return false;

  const expected = crypto
    .createHmac('sha256', MIKE_SECRET)
    .update(JSON.stringify(ack.payload))
    .digest('hex');

  return expected === ack.signature;
}

async function sendToMike(payload) {
  if (!MIKE_ENDPOINT || !MIKE_SECRET) {
    // MIKE not configured – skip silently
    return;
  }

  try {
    const signature = sign(payload);

    const res = await axios.post(MIKE_ENDPOINT, payload, {
      timeout: 3000,
      headers: {
        'x-signature': signature
      }
    });

    const ack = res.data;

    if (!verifyAck(ack)) {
      console.error('[MIKE] INVALID ACK');
      return;
    }

    console.log('[MIKE] ACK OK');

  } catch (err) {
    console.error('[MIKE ERROR]', err.message);
  }
}

module.exports = { sendToMike };


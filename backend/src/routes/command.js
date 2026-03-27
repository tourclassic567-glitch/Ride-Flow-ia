'use strict';

/**
 * POST /api/command
 *
 * Accepts authenticated commands directed at the Ride-Flow system.
 * This route is protected by the hmacAuth middleware mounted in app.js.
 *
 * Body (JSON):
 *   command  {string}  – command name (required)
 *   payload  {object}  – command-specific parameters (optional)
 *
 * Response:
 *   200 { status: "command accepted", command, keyId, timestamp }
 *   400 { error: "Bad Request", detail }
 */

const express = require('express');
const router = express.Router();
const telemetry = require('../observability/telemetry');
const { sendToMike } = require('../integrations/mikeForwarder');

router.post('/', (req, res) => {
  const { command, payload } = req.body;

  if (!command || typeof command !== 'string' || !command.trim()) {
    telemetry.recordError('command', 'missing or invalid command field');
    return res.status(400).json({ error: 'Bad Request', detail: 'command field is required' });
  }

  const cmd = command.trim();
  const pld = payload || {};
  const keyId = req.authenticatedKeyId;
  const timestamp = new Date().toISOString();

  // Record telemetry and forward to MIKE non-blocking
  telemetry.record('command', { command: cmd, keyId, payload: pld });
  setImmediate(() => sendToMike({ command: cmd, keyId, payload: pld, timestamp }));

  return res.status(200).json({
    status: 'command accepted',
    command: cmd,
    keyId,
    timestamp,
    payload: pld,
  });
});

module.exports = router;

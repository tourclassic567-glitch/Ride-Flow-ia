'use strict';

/**
 * POST /api/command
 *
 * Accepts commands directed at the Ride-Flow system.
 * This route is publicly accessible – no HMAC authentication required.
 *
 * Body (JSON):
 *   command  {string}  – command name or instruction (required)
 *   id       {string}  – optional command identifier
 *   type     {string}  – optional command type label
 *   payload  {object}  – command-specific parameters (optional)
 *
 * Response:
 *   200 { status: "command accepted", id, type, command, keyId, timestamp }
 *   400 { error: "Bad Request", detail }
 */

const express = require('express');
const router = express.Router();
const telemetry = require('../observability/telemetry');
const { sendToMike } = require('../integrations/mikeForwarder');

const DEFAULT_COMMAND_TYPE = 'command';

router.post('/', (req, res) => {
  const { command, id, type, payload } = req.body;

  if (!command || typeof command !== 'string' || !command.trim()) {
    telemetry.recordError('command', 'missing or invalid command field');
    return res.status(400).json({ error: 'Bad Request', detail: 'command field is required' });
  }

  const cmd = command.trim();
  const pld = payload || {};
  const keyId = req.authenticatedKeyId || null;
  const timestamp = new Date().toISOString();

  // Record telemetry and forward to MIKE non-blocking
  telemetry.record('command', { id, type, command: cmd, keyId, payload: pld });
  setImmediate(() => sendToMike({ id, type, command: cmd, keyId, payload: pld, timestamp }));

  return res.status(200).json({
    status: 'command accepted',
    id: id || null,
    type: type || DEFAULT_COMMAND_TYPE,
    command: cmd,
    keyId,
    timestamp,
    payload: pld,
  });
});

module.exports = router;

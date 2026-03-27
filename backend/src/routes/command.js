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

router.post('/', (req, res) => {
  const { command, payload } = req.body;

  if (!command || typeof command !== 'string' || !command.trim()) {
    return res.status(400).json({ error: 'Bad Request', detail: 'command field is required' });
  }

  console.log(`[command] RECEIVED command="${command}" key="${req.authenticatedKeyId}"`);

  return res.status(200).json({
    status: 'command accepted',
    command: command.trim(),
    keyId: req.authenticatedKeyId,
    timestamp: new Date().toISOString(),
    payload: payload || {},
  });
});

module.exports = router;

'use strict';

/**
 * POST /api/command
 *
 * Accepts commands directed at the Ride-Flow system.
 * This route is publicly accessible – no HMAC authentication required.
 *
 * Body (JSON):
 *   command  {string}  – command name or instruction (optional)
 *                        Supports EXECUTE:<FLOW_NAME> [KEY=VALUE …] syntax to
 *                        dispatch a named flow through the orchestrator.
 *                        When omitted the request is accepted and an executionId
 *                        is returned with no flow dispatched.
 *   id       {string}  – optional command identifier
 *   type     {string}  – optional command type label
 *   payload  {object}  – command-specific parameters (optional)
 *
 * Response:
 *   200 { status: "command accepted", executionId, id, type, command, keyId, timestamp }
 *   400 { error: "Bad Request", detail }
 *
 * EXECUTE syntax
 *   EXECUTE:RIDE_FLOW USER=001
 *     → flow: "ride-request-flow", context: { user_id: "001", ...payload }
 *   EXECUTE:LOCK
 *     → engage system lock; all subsequent flow executions are refused
 *   EXECUTE:UNLOCK
 *     → release system lock; flow executions are permitted again
 *
 * Lock state
 *   Initial lock state is seeded from the FORCE_LOCK environment variable:
 *     FORCE_LOCK=true  → server starts locked
 *     (absent / false) → server starts unlocked (default)
 *   Every response includes a "locked" boolean reflecting the current state.
 *
 * Flow name mapping (case-insensitive):
 *   RIDE_FLOW          → ride-request-flow
 *   RIDE_MATCH_FLOW    → ride-match-flow
 *   RIDE_PRICING_FLOW  → ride-pricing-flow
 *   RIDE_STATUS_FLOW   → ride-status-flow
 */

const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const telemetry = require('../observability/telemetry');
const { sendToMike } = require('../integrations/mikeForwarder');
const orchestrator = require('../flows/orchestrator');
const lockState = require('../security/lockState');

const DEFAULT_COMMAND_TYPE = 'command';

// Map from the EXECUTE:<TARGET> token to the registered flow name in engine.js
const FLOW_NAME_MAP = {
  RIDE_FLOW: 'ride-request-flow',
  RIDE_MATCH_FLOW: 'ride-match-flow',
  RIDE_PRICING_FLOW: 'ride-pricing-flow',
  RIDE_STATUS_FLOW: 'ride-status-flow',
};

/**
 * Parse "KEY=VALUE KEY2=VALUE2 …" tokens into a plain object.
 * @param {string[]} tokens
 * @returns {object}
 */
function parseParams(tokens) {
  return tokens.reduce((acc, token) => {
    const eq = token.indexOf('=');
    if (eq > 0) {
      const key = token.slice(0, eq).toLowerCase();
      acc[key] = token.slice(eq + 1);
    }
    return acc;
  }, {});
}

router.post('/', async (req, res) => {
  const { command, id, type, payload } = req.body;

  if (command !== undefined && (typeof command !== 'string' || !command.trim())) {
    telemetry.recordError('command', 'invalid command field');
    return res.status(400).json({ error: 'Bad Request', detail: 'command must be a non-empty string' });
  }

  const cmd = command ? command.trim() : null;
  const pld = payload || {};
  const keyId = req.authenticatedKeyId || null;
  const timestamp = new Date().toISOString();

  // Generate a cryptographically secure unique ID for this execution so callers
  // can correlate telemetry, logs, and MIKE ACKs back to a single command.
  const executionId = crypto.randomUUID();

  // ── EXECUTE:<FLOW|LOCK|UNLOCK> [KEY=VALUE …] dispatch ─────────────────────
  let flowResult = null;
  if (cmd && cmd.toUpperCase().startsWith('EXECUTE:')) {
    const parts = cmd.slice('EXECUTE:'.length).trim().split(/\s+/);
    const flowKey = parts[0].toUpperCase();

    if (flowKey === 'LOCK') {
      lockState.lock();
      flowResult = { action: 'LOCK', locked: true };
    } else if (flowKey === 'UNLOCK') {
      lockState.unlock();
      flowResult = { action: 'UNLOCK', locked: false };
    } else {
      const flowName = FLOW_NAME_MAP[flowKey];

      if (flowName) {
        const params = parseParams(parts.slice(1));
        const context = { ...pld, ...params, executionId };
        // Run non-blocking so the HTTP response is not held up by flow latency.
        setImmediate(async () => {
          try {
            await orchestrator.run(flowName, context);
          } catch (err) {
            telemetry.recordError('command', `flow dispatch failed: ${err.message}`);
          }
        });
        flowResult = { dispatched: true, flow: flowName };
      }
    }
  }

  // Record telemetry and forward to MIKE non-blocking
  telemetry.record('command', { executionId, id, type, command: cmd, keyId, payload: pld });
  setImmediate(() =>
    sendToMike({ executionId, id, type, command: cmd, keyId, payload: pld, timestamp })
  );

  return res.status(200).json({
    status: 'command accepted',
    executionId,
    id: id || null,
    type: type || DEFAULT_COMMAND_TYPE,
    command: cmd,
    keyId,
    timestamp,
    payload: pld,
    locked: lockState.isLocked(),
    ...(flowResult && { flow: flowResult }),
  });
});

module.exports = router;

'use strict';

const express = require('express');
const router = express.Router();
const eventBus = require('../events/eventBus');
const eventTypes = require('../events/eventTypes');
const telemetry = require('../observability/telemetry');
const { sendToMike } = require('../integrations/mikeForwarder');

const KNOWN_EVENTS = new Set(Object.values(eventTypes));

/**
 * POST /api/events/emit
 *
 * Publish an event onto the internal event bus non-blocking.
 * Responds immediately; subscribers are scheduled via setImmediate.
 *
 * Body:
 *   event  {string} – must be one of the known eventTypes constants
 *   data   {object} – arbitrary payload forwarded to subscribers (optional)
 *
 * Response:
 *   202 { status: "event accepted" }
 *   400 { success: false, error }
 */
router.post('/emit', (req, res) => {
  const { event, data } = req.body;

  if (!event) {
    telemetry.recordError('event', 'missing event field');
    return res.status(400).json({ success: false, error: 'Missing required field: event' });
  }

  if (!KNOWN_EVENTS.has(event)) {
    telemetry.recordError('event', `unknown event type: ${event}`);
    return res.status(400).json({
      success: false,
      error: `Unknown event type: "${event}". Valid types are: ${[...KNOWN_EVENTS].join(', ')}`,
    });
  }

  if (data !== undefined && (typeof data !== 'object' || Array.isArray(data) || data === null)) {
    telemetry.recordError('event', 'invalid data field');
    return res.status(400).json({ success: false, error: 'data must be a plain object' });
  }

  const payload = data || {};

  // Record telemetry and forward to MIKE before publishing the internal event
  telemetry.record('event', { event, data: payload, keyId: req.authenticatedKeyId });
  setImmediate(() => sendToMike({ event, data: payload, keyId: req.authenticatedKeyId }));

  // Schedule subscriber execution after the response is sent (non-blocking)
  eventBus.publishAsync(event, payload);

  return res.status(202).json({ status: 'event accepted' });
});

module.exports = router;

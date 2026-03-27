'use strict';

const express = require('express');
const router = express.Router();
const eventBus = require('../events/eventBus');
const eventTypes = require('../events/eventTypes');

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

  console.log(`[events] EVENT RECEIVED: ${event}`);

  if (!event) {
    return res.status(400).json({ success: false, error: 'Missing required field: event' });
  }

  if (!KNOWN_EVENTS.has(event)) {
    return res.status(400).json({
      success: false,
      error: `Unknown event type: "${event}". Valid types are: ${[...KNOWN_EVENTS].join(', ')}`,
    });
  }

  if (data !== undefined && (typeof data !== 'object' || Array.isArray(data) || data === null)) {
    return res.status(400).json({ success: false, error: 'data must be a plain object' });
  }

  const payload = data || {};

  // Schedule subscriber execution after the response is sent (non-blocking)
  eventBus.publishAsync(event, payload);

  console.log(`[events] EVENT DISPATCHED: ${event}`);

  return res.status(202).json({ status: 'event accepted' });
});

module.exports = router;

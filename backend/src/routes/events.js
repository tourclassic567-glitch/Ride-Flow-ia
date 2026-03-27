'use strict';

const express = require('express');
const router = express.Router();
const eventBus = require('../events/eventBus');
const eventTypes = require('../events/eventTypes');

const KNOWN_EVENTS = new Set(Object.values(eventTypes));

/**
 * POST /api/events/emit
 *
 * Publish an event onto the internal event bus.
 *
 * Body:
 *   event  {string} – must be one of the known eventTypes constants
 *   data   {object} – arbitrary payload forwarded to subscribers (optional)
 *
 * Response:
 *   200 { success: true, event, subscriberCount }
 *   400 { success: false, error }
 */
router.post('/emit', (req, res) => {
  const { event, data } = req.body;

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

  eventBus.publish(event, payload);

  const subscriberCount = eventBus.listenerCount(event);

  return res.status(200).json({ success: true, event, subscriberCount });
});

module.exports = router;

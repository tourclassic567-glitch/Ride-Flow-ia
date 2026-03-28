'use strict';

const express = require('express');
const router = express.Router();
const radar = require('../observability/radar');
const eventBus = require('../events/eventBus');
const eventTypes = require('../events/eventTypes');

/**
 * Build a snapshot of the event-driven layer:
 *   - which event types are defined
 *   - how many times each has been published
 *   - how many subscribers are active per event type
 *   - whether the system is fully event-driven (no zero-subscriber events that
 *     have already been published)
 */
function getEventDrivenStatus() {
  const busStats = eventBus.getStats();
  const defined = Object.values(eventTypes);

  // A system is "fully event driven" when every defined event type that has
  // been published has at least one active subscriber.
  const publishedWithNoSubscriber = defined.filter(
    (et) =>
      (busStats.publishCounts[et] || 0) > 0 &&
      (busStats.subscriberCounts[et] || 0) === 0
  );

  const fullyEventDriven = publishedWithNoSubscriber.length === 0;

  const eventTypeStats = defined.map((et) => ({
    eventType: et,
    published: busStats.publishCounts[et] || 0,
    subscribers: busStats.subscriberCounts[et] || 0,
  }));

  return {
    fullyEventDriven,
    totalPublished: busStats.totalPublished,
    eventTypeStats,
  };
}

// GET /api/radar – full system status
router.get('/', (_req, res) => {
  const status = radar.getSystemStatus();
  const eventDriven = getEventDrivenStatus();

  res.status(200).json({
    ...status,
    eventDriven,
  });
});

// POST /api/radar/update – record a flow execution
router.post('/update', (req, res) => {
  const { flow, status, duration, error } = req.body;

  if (!flow || !status || duration === undefined) {
    return res.status(400).json({ success: false, error: 'Missing required fields: flow, status, duration' });
  }

  if (status !== 'ok' && status !== 'error') {
    return res.status(400).json({ success: false, error: 'status must be "ok" or "error"' });
  }

  const durationMs = Number(duration);
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return res.status(400).json({ success: false, error: 'duration must be a non-negative number' });
  }

  radar.recordExecution({ flow, status, duration: durationMs, error });
  res.status(200).json({ success: true });
});

// GET /api/radar/health – quick health check
router.get('/health', (_req, res) => {
  const { status } = radar.getSystemStatus();
  res.status(200).json({
    healthy: status !== 'CRITICAL',
    status,
  });
});

// GET /api/radar/metrics – aggregated metrics only
router.get('/metrics', (_req, res) => {
  const systemStatus = radar.getSystemStatus();
  res.status(200).json(systemStatus.aggregatedMetrics);
});

module.exports = router;

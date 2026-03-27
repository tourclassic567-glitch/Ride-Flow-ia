'use strict';

const express = require('express');
const router = express.Router();
const radar = require('../observability/radar');

// GET /api/radar – full system status
router.get('/', (_req, res) => {
  const status = radar.getSystemStatus();
  res.status(200).json(status);
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

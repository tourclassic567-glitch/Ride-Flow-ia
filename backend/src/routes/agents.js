/**
 * GET  /agents        — aggregated status of all AI agents
 * POST /agents/start  — start the fleet (idempotent)
 * POST /agents/stop   — stop the fleet
 * GET  /agents/metrics — live metrics snapshot (pricing, monitoring, revenue)
 */
const express = require('express');
const router = express.Router();
const orchestrator = require('../agents/AgentOrchestrator');

// GET /agents
router.get('/', (_req, res) => {
  res.json(orchestrator.status());
});

// GET /agents/metrics
router.get('/metrics', (_req, res) => {
  const full = orchestrator.status();
  res.json(full.metrics);
});

// POST /agents/start
router.post('/start', (_req, res) => {
  try {
    orchestrator.start();
    res.json({ message: 'Agent fleet started', status: orchestrator.status() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start agent fleet', detail: err.message });
  }
});

// POST /agents/stop
router.post('/stop', (_req, res) => {
  orchestrator.stop();
  res.json({ message: 'Agent fleet stopped' });
});

module.exports = router;

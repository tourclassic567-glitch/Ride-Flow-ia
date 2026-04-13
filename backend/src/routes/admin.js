/**
 * Admin routes — all require X-Admin-Key header (see adminAuth middleware).
 *
 * GET /api/v1/admin/health            — Status of all agents
 * GET /api/v1/admin/metrics           — Real-time metrics
 * GET /api/v1/admin/agents            — Agent list
 * GET /api/v1/admin/scheduler/tasks   — Scheduled tasks
 */
const express = require('express');
const router = express.Router();
const orchestrator = require('../agents/AgentOrchestrator');
const scheduler    = require('../services/scheduler');

// GET /api/v1/admin/health
router.get('/health', (_req, res) => {
  const full = orchestrator.status();
  const allRunning = full.agents.every((a) => a.running);
  res.json({
    status: allRunning ? 'healthy' : 'degraded',
    orchestrator: full.orchestrator,
    agents: full.agents.map((a) => ({
      name:      a.name,
      running:   a.running,
      ticks:     a.stats.ticks,
      errors:    a.stats.errors,
      lastTick:  a.stats.lastTick,
      lastError: a.stats.lastError,
    })),
    checkedAt: new Date().toISOString(),
  });
});

// GET /api/v1/admin/metrics
router.get('/metrics', (_req, res) => {
  const full = orchestrator.status();
  const memUsage = process.memoryUsage();
  res.json({
    agentMetrics: full.metrics,
    system: {
      uptimeSeconds: Math.floor(process.uptime()),
      memoryMb: {
        rss:       parseFloat((memUsage.rss       / 1024 / 1024).toFixed(1)),
        heapUsed:  parseFloat((memUsage.heapUsed  / 1024 / 1024).toFixed(1)),
        heapTotal: parseFloat((memUsage.heapTotal / 1024 / 1024).toFixed(1)),
      },
    },
    collectedAt: new Date().toISOString(),
  });
});

// GET /api/v1/admin/agents
router.get('/agents', (_req, res) => {
  const full = orchestrator.status();
  res.json({
    count:  full.agents.length,
    agents: full.agents,
    asOf:   new Date().toISOString(),
  });
});

// GET /api/v1/admin/scheduler/tasks
router.get('/scheduler/tasks', (_req, res) => {
  res.json({
    tasks: scheduler.getTasks(),
    count: scheduler.getTasks().length,
    asOf:  new Date().toISOString(),
  });
});

module.exports = router;

/**
 * /api/v1/admin — admin-only endpoints (protected by adminAuth middleware).
 *
 * GET /api/v1/admin/health          — status of all agents
 * GET /api/v1/admin/metrics         — real-time metrics snapshot
 * GET /api/v1/admin/agents          — list of agents with details
 * GET /api/v1/admin/scheduler/tasks — scheduled agent task registry
 */
const express      = require('express');
const router       = express.Router();
const orchestrator = require('../../agents/AgentOrchestrator');

/* ─── GET /health ─── */
router.get('/health', (_req, res) => {
  const full = orchestrator.status();
  const allRunning = full.agents.every((a) => a.running);

  res.json({
    status: allRunning ? 'healthy' : 'degraded',
    orchestrator: full.orchestrator,
    agents: full.agents.map((a) => ({
      name:      a.name,
      running:   a.running,
      lastTick:  a.stats?.lastTick  || null,
      lastError: a.stats?.lastError || null,
      errors:    a.stats?.errors    || 0,
      ticks:     a.stats?.ticks     || 0,
    })),
    timestamp: new Date().toISOString(),
  });
});

/* ─── GET /metrics ─── */
router.get('/metrics', (_req, res) => {
  const full = orchestrator.status();
  res.json({
    metrics:   full.metrics,
    timestamp: new Date().toISOString(),
  });
});

/* ─── GET /agents ─── */
router.get('/agents', (_req, res) => {
  const full = orchestrator.status();
  res.json({
    agentCount: full.orchestrator.agentCount,
    agents: full.agents,
    timestamp: new Date().toISOString(),
  });
});

/* ─── GET /scheduler/tasks ─── */
router.get('/scheduler/tasks', (_req, res) => {
  const full = orchestrator.status();

  const tasks = full.agents.map((a) => ({
    name:          a.name,
    intervalMs:    a.intervalMs,
    intervalLabel: formatInterval(a.intervalMs),
    running:       a.running,
    startedAt:     a.stats?.startedAt || null,
    nextTickAt:    a.running && a.stats?.lastTick
      ? new Date(new Date(a.stats.lastTick).getTime() + a.intervalMs).toISOString()
      : null,
    ticks:         a.stats?.ticks  || 0,
    errors:        a.stats?.errors || 0,
  }));

  res.json({ tasks, timestamp: new Date().toISOString() });
});

/** Human-readable interval string, e.g. 30000 → "30s", 3600000 → "1h" */
function formatInterval(ms) {
  if (ms >= 3_600_000) return `${ms / 3_600_000}h`;
  if (ms >= 60_000)    return `${ms / 60_000}m`;
  return `${ms / 1000}s`;
}

module.exports = router;

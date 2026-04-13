/**
 * /api/v1/services — AI completion, data processing, hosting plans/status.
 *
 * POST /api/v1/services/ai/complete
 * POST /api/v1/services/data/process
 * GET  /api/v1/services/hosting/plans
 * GET  /api/v1/services/hosting/status
 */
const express = require('express');
const router  = express.Router();

/* ─── Hosting plans catalogue ─── */
const HOSTING_PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price_usd_month: 9,
    vcpu: 1,
    ram_gb: 2,
    storage_gb: 20,
    bandwidth_tb: 1,
    features: ['Shared CPU', 'Automatic backups', 'Basic monitoring'],
  },
  {
    id: 'professional',
    name: 'Professional',
    price_usd_month: 29,
    vcpu: 2,
    ram_gb: 8,
    storage_gb: 80,
    bandwidth_tb: 5,
    features: ['Dedicated vCPU', 'Daily backups', 'Advanced monitoring', 'Priority support'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price_usd_month: 99,
    vcpu: 8,
    ram_gb: 32,
    storage_gb: 320,
    bandwidth_tb: 20,
    features: [
      'Dedicated vCPU',
      'Hourly backups',
      'Full observability stack',
      '24/7 support',
      'SLA 99.9%',
    ],
  },
];

/* ─── POST /ai/complete ─── */
router.post('/ai/complete', (req, res) => {
  const { prompt, max_tokens = 256, temperature = 0.7 } = req.body || {};

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: '`prompt` is required and must be a non-empty string' });
  }

  if (typeof max_tokens !== 'number' || max_tokens < 1 || max_tokens > 4096) {
    return res.status(400).json({ error: '`max_tokens` must be a number between 1 and 4096' });
  }

  // In production, replace this stub with a real LLM call (e.g. OpenAI, Anthropic).
  const completion = `[AI response to: "${prompt.slice(0, 80)}${prompt.length > 80 ? '…' : ''}"]`;

  return res.json({
    model: process.env.AI_MODEL || 'gpt-mock',
    prompt,
    completion,
    usage: {
      prompt_tokens: Math.ceil(prompt.length / 4),
      completion_tokens: Math.ceil(completion.length / 4),
      total_tokens: Math.ceil((prompt.length + completion.length) / 4),
    },
  });
});

/* ─── POST /data/process ─── */
router.post('/data/process', (req, res) => {
  const { data, operation = 'summarize' } = req.body || {};

  if (!data) {
    return res.status(400).json({ error: '`data` is required' });
  }

  const SUPPORTED_OPERATIONS = ['summarize', 'transform', 'validate', 'enrich'];
  if (!SUPPORTED_OPERATIONS.includes(operation)) {
    return res.status(400).json({
      error: `Unsupported operation. Supported: ${SUPPORTED_OPERATIONS.join(', ')}`,
    });
  }

  const inputSize = JSON.stringify(data).length;

  const result = {
    operation,
    inputSize,
    processedAt: new Date().toISOString(),
    output: data,          // passthrough in mock mode
    metadata: {
      rows: Array.isArray(data) ? data.length : 1,
      fields: typeof data === 'object' && !Array.isArray(data) ? Object.keys(data).length : null,
    },
  };

  return res.json(result);
});

/* ─── GET /hosting/plans ─── */
router.get('/hosting/plans', (_req, res) => {
  res.json({ plans: HOSTING_PLANS });
});

/* ─── GET /hosting/status ─── */
router.get('/hosting/status', (_req, res) => {
  const uptimeSec = Math.round(process.uptime());
  res.json({
    status: 'operational',
    uptime_seconds: uptimeSec,
    region: process.env.HOSTING_REGION || 'us-east-1',
    services: {
      api:      'operational',
      database: process.env.DATABASE_URL ? 'configured' : 'mock',
      storage:  process.env.HETZNER_BACKUP_HOST ? 'configured' : 'not_configured',
    },
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;

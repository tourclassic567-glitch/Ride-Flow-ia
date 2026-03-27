'use strict';

const express = require('express');
const router = express.Router();
const engine = require('../flows/engine');
const logger = require('../utils/logger');

// Basic auth middleware — checks for a Bearer token when AUTH_TOKEN is set.
function authenticate(req, res, next) {
  const token = process.env.AUTH_TOKEN;
  if (!token) return next(); // auth disabled if env var not set

  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ') || header.slice(7) !== token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Validate flow name parameter
function validateFlowName(req, res, next) {
  const { flowName } = req.params;
  if (!flowName || !/^[a-zA-Z0-9_-]+$/.test(flowName)) {
    return res.status(400).json({ error: 'Invalid flow name' });
  }
  next();
}

/**
 * GET /api/flows/list
 * List all registered flows with metadata.
 */
router.get('/list', (req, res) => {
  const flows = engine.list();
  res.json({ count: flows.length, flows });
});

/**
 * GET /api/flows/:flowName
 * Get a single flow definition.
 */
router.get('/:flowName', validateFlowName, (req, res) => {
  const flow = engine.get(req.params.flowName);
  if (!flow) {
    return res.status(404).json({ error: `Flow '${req.params.flowName}' not found` });
  }
  res.json(flow);
});

/**
 * POST /api/flows/run/:flowName
 * Execute a registered flow with the request body as payload.
 */
router.post('/run/:flowName', authenticate, validateFlowName, async (req, res, next) => {
  const { flowName } = req.params;
  const payload = req.body || {};

  if (!engine.get(flowName)) {
    return res.status(404).json({ error: `Flow '${flowName}' not found` });
  }

  try {
    const result = await engine.run(flowName, payload);
    const statusCode = result.success ? 200 : 422;
    logger.info('Flow execution finished via API', { flow: flowName, success: result.success, durationMs: result.durationMs });
    res.status(statusCode).json(result);
  } catch (err) {
    logger.error('Flow execution error via API', { flow: flowName, error: err.message });
    next(err);
  }
});

module.exports = router;

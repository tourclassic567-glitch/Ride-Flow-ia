'use strict';

const engine = require('../flows/engine');
const logger = require('../utils/logger');

/**
 * High-level orchestrator.
 * Provides a simple interface for other modules to execute flows
 * without depending directly on the engine singleton.
 */

/**
 * Execute a named flow with a given payload and optional context metadata.
 *
 * @param {string} name      - Registered flow name (e.g. 'ride-request-flow')
 * @param {object} payload   - Input payload for the flow
 * @param {object} [context] - Optional metadata (requestId, userId, etc.)
 * @returns {Promise<object>} Execution result { success, outputs, errors, durationMs }
 */
async function executeFlow(name, payload = {}, context = {}) {
  logger.info('Orchestrator: starting flow', { flow: name, context });
  try {
    const result = await engine.run(name, payload);
    logger.info('Orchestrator: flow completed', {
      flow: name,
      success: result.success,
      durationMs: result.durationMs,
    });
    return result;
  } catch (err) {
    logger.error('Orchestrator: flow failed', { flow: name, error: err.message });
    throw err;
  }
}

/**
 * Return the list of registered flows (delegated to engine).
 * @returns {object[]}
 */
function listFlows() {
  return engine.list();
}

module.exports = { executeFlow, listFlows };

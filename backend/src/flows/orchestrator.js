'use strict';

/**
 * Orchestrator – the single control layer for all flow execution.
 *
 * Responsibilities:
 *   - Accept flow-run requests from routes/controllers
 *   - Delegate execution to the executor
 *   - Handle retries with incremental back-off for transient errors
 *   - Skip retries immediately for non-retryable errors (err.retryable === false,
 *     e.g. LockError when FORCE_LOCK is active)
 *   - Emit FLOW_RETRY / FLOW_FAILED events for observability
 *   - Provide failure recovery (throws after exhausting retries)
 *
 * Routes must NEVER call the executor or engine directly;
 * they must go through orchestrator.run().
 */

const executor = require('./executor');
const eventBus = require('../events/eventBus');
const eventTypes = require('../events/eventTypes');

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_DELAY_MS = 500;

/**
 * Run a named flow with automatic retry / failure recovery.
 *
 * @param {string} flowName  - Registered flow name (see engine.js).
 * @param {object} context   - Input data for the flow.
 * @param {object} [options]
 * @param {number} [options.maxRetries=3]       - Max total attempts.
 * @param {number} [options.retryDelay=500]     - Base delay in ms (multiplied by attempt).
 * @returns {Promise<*>} Resolved value returned by the flow.
 */
async function run(flowName, context, options = {}) {
  const {
    maxRetries = DEFAULT_MAX_RETRIES,
    retryDelay = DEFAULT_RETRY_DELAY_MS,
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await executor.execute(flowName, context);
    } catch (err) {
      lastError = err;

      // Non-retryable errors (e.g. LockError) must fail immediately.
      // Retrying a hard gate wastes time, emits spurious FLOW_RETRY events,
      // and defeats the purpose of the lock.
      if (err.retryable === false) {
        break;
      }

      if (attempt < maxRetries) {
        eventBus.publish(eventTypes.FLOW_RETRY, {
          flowName,
          attempt,
          maxRetries,
          error: err.message,
          timestamp: new Date().toISOString(),
        });
        await sleep(retryDelay * attempt); // incremental back-off: 500 ms, 1000 ms, …
      }
    }
  }

  eventBus.publish(eventTypes.FLOW_FAILED, {
    source: flowName,
    error: lastError.message,
    retryable: lastError.retryable !== false,
    timestamp: new Date().toISOString(),
  });

  throw lastError;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { run };

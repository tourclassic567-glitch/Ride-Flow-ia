'use strict';

/**
 * Flow executor – runs a named flow from the engine and reports
 * the outcome to the radar observability module (non-blocking).
 */

const engine = require('./engine');
const lockState = require('../security/lockState');

/**
 * Thrown when a flow execution is attempted while the system lock is active.
 * Marked `retryable: false` so the orchestrator skips its retry loop and
 * fails instantly — a lock is an intentional gate, not a transient error.
 */
class LockError extends Error {
  constructor(flowName) {
    super(`Flow execution refused: system is locked (FORCE_LOCK). Flow: ${flowName}`);
    this.name = 'LockError';
    this.code = 'FLOW_LOCKED';
    this.retryable = false;
  }
}

async function execute(flowName, context) {
  if (lockState.isLocked()) {
    throw new LockError(flowName);
  }

  const startTime = Date.now();
  let error = null;

  try {
    const result = await engine.run(flowName, context);
    return result;
  } catch (err) {
    error = err;
    throw err;
  } finally {
    // Non-blocking radar update
    try {
      const radar = require('../observability/radar');
      radar.recordExecution({
        flow: flowName,
        status: error ? 'error' : 'ok',
        duration: Date.now() - startTime,
        error: error ? error.message : undefined,
      });
    } catch (radarErr) {
      // Radar update must never crash the executor
      console.warn('Radar update failed (non-blocking)', { error: radarErr.message });
    }
  }
}

module.exports = { execute, LockError };

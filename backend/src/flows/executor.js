'use strict';

/**
 * Flow executor – runs a named flow from the engine and reports
 * the outcome to the radar observability module (non-blocking).
 */

const engine = require('./engine');

async function execute(flowName, context) {
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

module.exports = { execute };

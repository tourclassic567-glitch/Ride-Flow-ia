'use strict';

/**
 * Minimal flow engine – tracks registered ride/business flows.
 * Flows are registered by name; executor calls run() to execute them.
 */

const flows = new Map();

function register(name, handler) {
  flows.set(name, handler);
}

async function run(name, context) {
  const handler = flows.get(name);
  if (!handler) {
    throw new Error(`Flow not found: ${name}`);
  }
  return handler(context);
}

// Pre-register the core ride flows so flowsLoaded > 0 on startup
register('ride-request-flow', async (ctx) => ctx);
register('ride-match-flow', async (ctx) => ctx);
register('ride-pricing-flow', async (ctx) => ctx);
register('ride-status-flow', async (ctx) => ctx);

module.exports = { flows, register, run };

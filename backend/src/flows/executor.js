'use strict';

const serviceRegistry = require('../services/registry');
const { broadcast } = require('../services/websocket');
const { EventTypes } = require('../utils/eventTypes');
const logger = require('../utils/logger');

/**
 * Resolve a JSONPath-like reference from the execution context.
 * Supported patterns:
 *   $.payload.<field>        → context.payload[field]
 *   $.<stepId>.<field>       → context.outputs[stepId][field]
 *
 * @param {string} ref
 * @param {object} context  { payload, outputs }
 * @returns {*}
 */
function resolveRef(ref, context) {
  if (typeof ref !== 'string' || !ref.startsWith('$.')) return ref;

  const parts = ref.slice(2).split('.');
  const root = parts[0];

  if (root === 'payload') {
    return parts.slice(1).reduce((acc, key) => (acc != null ? acc[key] : undefined), context.payload);
  }

  // step reference
  const stepOutput = context.outputs[root];
  return parts.slice(1).reduce((acc, key) => (acc != null ? acc[key] : undefined), stepOutput);
}

/**
 * Build the input object for a step by resolving all $. references.
 */
function buildInput(inputMap, context) {
  if (!inputMap || typeof inputMap !== 'object') return {};
  const resolved = {};
  for (const [key, val] of Object.entries(inputMap)) {
    resolved[key] = resolveRef(val, context);
  }
  return resolved;
}

/**
 * Execute a single 'service' type step.
 */
async function executeServiceStep(step, context) {
  const svc = serviceRegistry.resolve(step.service);
  const input = buildInput(step.input, context);
  logger.debug('Executing service step', { stepId: step.id, service: step.service, method: step.method, input });

  const timeoutMs = step.timeout || 10000;
  const result = await Promise.race([
    svc[step.method](input),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Step '${step.id}' timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);

  return result;
}

/**
 * Execute a single 'event' type step.
 * Emits via WebSocket broadcast and returns the emitted data.
 */
async function executeEventStep(step, context) {
  const data = buildInput(step.data, context);
  const payload = { type: step.event, ...data, _timestamp: new Date().toISOString() };
  logger.debug('Emitting event step', { stepId: step.id, event: step.event, data });
  broadcast(payload);
  return { emitted: step.event, data };
}

/**
 * Attempt rollback actions for a failed step.
 */
async function runRollback(failedStepId, flow, context) {
  if (!flow.rollback || !Array.isArray(flow.rollback)) return;

  const rollbackActions = flow.rollback.filter((rb) => rb.onFail === failedStepId);
  for (const rb of rollbackActions) {
    try {
      logger.info('Running rollback action', { onFail: failedStepId, service: rb.service, method: rb.method });
      const svc = serviceRegistry.resolve(rb.service);
      const input = buildInput(rb.input, context);
      await svc[rb.method](input);
    } catch (rbErr) {
      logger.error('Rollback action failed', { onFail: failedStepId, error: rbErr.message });
    }
  }
}

/**
 * Execute all steps of a flow sequentially.
 *
 * @param {object} flow        Full flow definition
 * @param {object} payload     Initial payload from the caller
 * @param {object} eventBus    EventEmitter used to emit internal system events
 * @returns {object}           Execution result { success, outputs, errors, durationMs }
 */
async function executeFlow(flow, payload, eventBus) {
  const startedAt = Date.now();
  const context = { payload, outputs: {} };
  const errors = [];
  let success = true;

  // Emit FLOW_STARTED
  eventBus.emit(EventTypes.FLOW_STARTED, { flow: flow.name, payload });

  for (const step of flow.steps) {
    const stepStart = Date.now();
    try {
      let output;
      if (step.type === 'service') {
        output = await executeServiceStep(step, context);
      } else if (step.type === 'event') {
        output = await executeEventStep(step, context);
      } else {
        throw new Error(`Unknown step type '${step.type}'`);
      }

      context.outputs[step.id] = output;
      const stepDuration = Date.now() - stepStart;

      logger.info('Step completed', { flow: flow.name, stepId: step.id, durationMs: stepDuration });
      eventBus.emit(EventTypes.STEP_COMPLETED, {
        flow: flow.name,
        stepId: step.id,
        output,
        durationMs: stepDuration,
      });
    } catch (err) {
      const stepDuration = Date.now() - stepStart;
      logger.error('Step failed', {
        flow: flow.name,
        stepId: step.id,
        error: err.message,
        durationMs: stepDuration,
      });

      errors.push({ stepId: step.id, error: err.message, durationMs: stepDuration });
      eventBus.emit(EventTypes.STEP_FAILED, { flow: flow.name, stepId: step.id, error: err.message });

      // Attempt rollback
      await runRollback(step.id, flow, context);

      const onError = step.onError || 'throw';
      if (onError === 'throw') {
        success = false;
        break;
      }
      // onError === 'continue' — record error but keep executing
      context.outputs[step.id] = { error: err.message };
    }
  }

  const durationMs = Date.now() - startedAt;

  if (success) {
    eventBus.emit(EventTypes.FLOW_COMPLETED, { flow: flow.name, durationMs });
  } else {
    eventBus.emit(EventTypes.FLOW_FAILED, { flow: flow.name, errors, durationMs });
  }

  return { success, outputs: context.outputs, errors, durationMs };
}

module.exports = { executeFlow };

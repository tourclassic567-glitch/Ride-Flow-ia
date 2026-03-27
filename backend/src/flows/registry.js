'use strict';

const { isValidEvent } = require('../utils/eventTypes');
const serviceRegistry = require('../services/registry');

const VALID_STEP_TYPES = new Set(['service', 'event']);

/**
 * Validate a single flow step.
 * @param {object} step
 * @param {number} index
 * @throws {Error} on invalid step
 */
function validateStep(step, index) {
  const prefix = `Step[${index}] (id=${step.id || 'unknown'})`;

  if (!step.id || typeof step.id !== 'string') {
    throw new Error(`${prefix}: missing or invalid 'id'`);
  }
  if (!step.type || !VALID_STEP_TYPES.has(step.type)) {
    throw new Error(`${prefix}: 'type' must be 'service' or 'event', got '${step.type}'`);
  }

  if (step.type === 'service') {
    if (!step.service || !serviceRegistry.has(step.service)) {
      throw new Error(
        `${prefix}: service '${step.service}' is not registered. Available: ${serviceRegistry.list().join(', ')}`
      );
    }
    const svc = serviceRegistry.resolve(step.service);
    if (!step.method || typeof svc[step.method] !== 'function') {
      throw new Error(
        `${prefix}: method '${step.method}' does not exist on service '${step.service}'`
      );
    }
  }

  if (step.type === 'event') {
    if (!step.event || !isValidEvent(step.event)) {
      throw new Error(
        `${prefix}: event '${step.event}' is not defined in eventTypes.js`
      );
    }
  }
}

/**
 * Validate a complete flow definition.
 * @param {object} flow
 * @throws {Error} on invalid flow
 */
function validateFlow(flow) {
  if (!flow || typeof flow !== 'object') throw new Error('Flow must be a plain object');
  if (!flow.name || typeof flow.name !== 'string') throw new Error("Flow must have a 'name' string");
  if (!flow.version || typeof flow.version !== 'string') throw new Error("Flow must have a 'version' string");
  if (!Array.isArray(flow.steps) || flow.steps.length === 0) {
    throw new Error(`Flow '${flow.name}': 'steps' must be a non-empty array`);
  }

  const stepIds = new Set();
  flow.steps.forEach((step, i) => {
    validateStep(step, i);
    if (stepIds.has(step.id)) {
      throw new Error(`Flow '${flow.name}': duplicate step id '${step.id}'`);
    }
    stepIds.add(step.id);
  });

  // Validate rollback entries if present
  if (flow.rollback) {
    if (!Array.isArray(flow.rollback)) {
      throw new Error(`Flow '${flow.name}': 'rollback' must be an array`);
    }
    flow.rollback.forEach((rb, i) => {
      if (!rb.onFail || !stepIds.has(rb.onFail)) {
        throw new Error(
          `Flow '${flow.name}': rollback[${i}].onFail '${rb.onFail}' does not match any step id`
        );
      }
    });
  }
}

module.exports = { validateFlow, validateStep };

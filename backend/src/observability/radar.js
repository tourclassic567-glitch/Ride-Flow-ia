'use strict';

/**
 * Radar – real-time observability module.
 *
 * Tracks execution metrics, memory usage, uptime, and determines
 * an overall system health status (OK / DEGRADED / CRITICAL).
 */

const MAX_HISTORY = 20;

let startTime = Date.now();
let executions = []; // last MAX_HISTORY execution records
let totalExecutions = 0;
let successfulExecutions = 0;
let failedExecutions = 0;
let totalDuration = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toMB(bytes) {
  return parseFloat((bytes / 1024 / 1024).toFixed(2));
}

function getFlowsLoaded() {
  try {
    const engine = require('../flows/engine');
    return engine.flows.size;
  } catch (_err) {
    return 0;
  }
}

function buildAggregatedMetrics() {
  const errorRate =
    totalExecutions === 0 ? 0 : parseFloat(((failedExecutions / totalExecutions) * 100).toFixed(2));

  const averageDuration =
    totalExecutions === 0 ? 0 : parseFloat((totalDuration / totalExecutions).toFixed(2));

  return {
    totalExecutions,
    successfulExecutions,
    failedExecutions,
    averageDuration,
    errorRate,
    statusHistory: executions.map((e) => e.status),
  };
}

function determineStatus(flowsLoaded, lastExecution, aggregated, memMB) {
  const heapPercent =
    memMB.heapTotal > 0 ? (memMB.heapUsed / memMB.heapTotal) * 100 : 0;

  // CRITICAL conditions
  if (flowsLoaded === 0) return 'CRITICAL';
  if (lastExecution && lastExecution.status === 'error') return 'CRITICAL';
  if (aggregated.errorRate > 50) return 'CRITICAL';
  if (lastExecution && lastExecution.duration > 30000) return 'CRITICAL';

  // DEGRADED conditions
  if (lastExecution && lastExecution.duration > 5000) return 'DEGRADED';
  if (aggregated.errorRate > 30) return 'DEGRADED';
  if (heapPercent > 80) return 'DEGRADED';
  if (lastExecution && lastExecution.duration < 1) return 'DEGRADED';

  return 'OK';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate and return the current system status.
 *
 * @param {object|null} lastExecution - Optional override for the last execution
 *   record (used internally; callers should omit this argument).
 */
function getSystemStatus(lastExecution) {
  const rawMem = process.memoryUsage();
  const memory = {
    heapUsed: toMB(rawMem.heapUsed),
    heapTotal: toMB(rawMem.heapTotal),
    external: toMB(rawMem.external),
    rss: toMB(rawMem.rss),
  };

  const flowsLoaded = getFlowsLoaded();
  const aggregated = buildAggregatedMetrics();

  // Last execution comes from the in-memory history (most recent first)
  const last = lastExecution || (executions.length > 0 ? executions[executions.length - 1] : null);

  const status = determineStatus(flowsLoaded, last, aggregated, memory);

  return {
    status,
    flowsLoaded,
    uptime: Date.now() - startTime,
    memory,
    lastExecution: last || null,
    aggregatedMetrics: aggregated,
  };
}

/**
 * Record a flow execution outcome.
 *
 * @param {object} execution
 * @param {string} execution.flow      - Flow name
 * @param {string} execution.status    - "ok" | "error"
 * @param {number} execution.duration  - Duration in ms
 * @param {string} [execution.error]   - Error message (optional)
 */
function recordExecution(execution) {
  const record = {
    flowName: execution.flow,
    status: execution.status,
    duration: execution.duration,
    timestamp: new Date().toISOString(),
  };
  if (execution.error) {
    record.error = execution.error;
  }

  // Update cumulative counters
  totalExecutions += 1;
  totalDuration += execution.duration;
  if (execution.status === 'error') {
    failedExecutions += 1;
  } else {
    successfulExecutions += 1;
  }

  // Keep only the last MAX_HISTORY records
  executions.push(record);
  if (executions.length > MAX_HISTORY) {
    executions.shift();
  }
}

/**
 * Return all collected raw metrics (executions log + counters).
 */
function getMetrics() {
  return {
    executions: executions.slice(),
    totalExecutions,
    successfulExecutions,
    failedExecutions,
    totalDuration,
    uptime: Date.now() - startTime,
  };
}

/**
 * Initialize radar on server startup.
 * Resets the start time so uptime is measured from server boot.
 */
function initialize() {
  startTime = Date.now();
  executions = [];
  totalExecutions = 0;
  successfulExecutions = 0;
  failedExecutions = 0;
  totalDuration = 0;
}

module.exports = {
  getSystemStatus,
  recordExecution,
  getMetrics,
  initialize,
};

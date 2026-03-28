'use strict';

/**
 * Telemetry Store
 *
 * Lightweight in-memory telemetry for the Ride-Flow backend.
 * Tracks three categories of entries:
 *
 *   event   – every event published via POST /api/events/emit
 *   command – every command accepted via POST /api/command
 *   error   – validation / processing errors on protected routes
 *
 * All operations are synchronous and O(1) amortised so they never
 * add measurable latency to request handlers.
 *
 * The rolling history is capped at MAX_ENTRIES per category to
 * keep memory usage bounded.
 */

const MAX_ENTRIES = 100;

const _state = {
  event: { count: 0, errorCount: 0, entries: [] },
  command: { count: 0, errorCount: 0, entries: [] },
  error: { count: 0, entries: [] },
};

/**
 * Record a telemetry entry.
 *
 * @param {'event'|'command'|'error'} type
 * @param {object} data – arbitrary context (event name, command name, reason, …)
 */
function record(type, data) {
  if (!_state[type]) return;

  const entry = { ...data, timestamp: new Date().toISOString() };
  const bucket = _state[type];

  bucket.count += 1;
  bucket.entries.push(entry);

  // Rolling window – discard oldest when we exceed the cap
  if (bucket.entries.length > MAX_ENTRIES) {
    bucket.entries.shift();
  }
}

/**
 * Increment the error count for a specific category (event or command).
 * Call this when a request to that route is rejected due to a bad payload.
 *
 * @param {'event'|'command'} category
 * @param {string} reason
 */
function recordError(category, reason) {
  // Track under the generic "error" bucket
  record('error', { category, reason });

  // Also bump the errorCount on the originating category if it exists
  if (_state[category]) {
    _state[category].errorCount = (_state[category].errorCount || 0) + 1;
  }
}

/**
 * Return a snapshot of all telemetry statistics.
 *
 * @returns {object}
 */
function getStats() {
  return {
    events: {
      total: _state.event.count,
      errors: _state.event.errorCount,
      recent: _state.event.entries.slice(-10),
    },
    commands: {
      total: _state.command.count,
      errors: _state.command.errorCount,
      recent: _state.command.entries.slice(-10),
    },
    errors: {
      total: _state.error.count,
      recent: _state.error.entries.slice(-10),
    },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Reset all telemetry counters (useful for testing).
 */
function reset() {
  _state.event = { count: 0, errorCount: 0, entries: [] };
  _state.command = { count: 0, errorCount: 0, entries: [] };
  _state.error = { count: 0, entries: [] };
}

module.exports = { record, recordError, getStats, reset };

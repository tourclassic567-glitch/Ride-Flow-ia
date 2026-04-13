/**
 * Scheduler — lightweight in-memory task registry.
 *
 * Agents register their scheduled tasks here so that the
 * GET /api/v1/admin/scheduler/tasks endpoint can surface them.
 */
class Scheduler {
  constructor() {
    this._tasks = new Map();
  }

  /**
   * Register a named task.
   * @param {string} name        Unique task identifier
   * @param {object} descriptor  { description, intervalMs, nextRunAt, lastRunAt, status }
   */
  register(name, descriptor) {
    this._tasks.set(name, {
      name,
      ...descriptor,
      registeredAt: new Date().toISOString(),
    });
  }

  /**
   * Update mutable fields for an existing task (lastRunAt, nextRunAt, status).
   * @param {string} name
   * @param {object} patch
   */
  update(name, patch) {
    const existing = this._tasks.get(name);
    if (existing) {
      this._tasks.set(name, { ...existing, ...patch });
    }
  }

  /** Returns all registered tasks as an array. */
  getTasks() {
    return Array.from(this._tasks.values());
  }
}

module.exports = new Scheduler();

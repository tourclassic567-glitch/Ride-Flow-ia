/**
 * BaseAgent – shared lifecycle for every autonomous AI agent.
 * Each agent runs on a configurable interval and can recover from errors.
 */
class BaseAgent {
  /**
   * @param {string} name       Human-readable agent name
   * @param {number} intervalMs How often the agent's tick() runs (ms)
   */
  constructor(name, intervalMs) {
    this.name = name;
    this.intervalMs = intervalMs;
    this.running = false;
    this._timer = null;
    this.stats = {
      ticks: 0,
      errors: 0,
      lastTick: null,
      lastError: null,
      startedAt: null,
    };
  }

  /** Override in subclasses – the actual agent work */
  async tick() {
    throw new Error(`${this.name}: tick() not implemented`);
  }

  /** Start the recurring tick loop */
  start() {
    if (this.running) return;
    this.running = true;
    this.stats.startedAt = new Date().toISOString();
    console.log(`[Agent:${this.name}] started (every ${this.intervalMs}ms)`);

    // Run first tick immediately, then schedule
    this._runTick();
    this._timer = setInterval(() => this._runTick(), this.intervalMs);
  }

  /** Stop the recurring tick loop */
  stop() {
    if (!this.running) return;
    this.running = false;
    clearInterval(this._timer);
    this._timer = null;
    console.log(`[Agent:${this.name}] stopped`);
  }

  async _runTick() {
    try {
      await this.tick();
      this.stats.ticks++;
      this.stats.lastTick = new Date().toISOString();
    } catch (err) {
      this.stats.errors++;
      this.stats.lastError = err.message;
      console.error(`[Agent:${this.name}] tick error:`, err.message);
    }
  }

  /** Snapshot of agent health for the /agents status endpoint */
  status() {
    return {
      name: this.name,
      running: this.running,
      intervalMs: this.intervalMs,
      stats: this.stats,
    };
  }
}

module.exports = BaseAgent;

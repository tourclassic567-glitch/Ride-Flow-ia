/**
 * AgentOrchestrator — single point of control for all autonomous AI agents.
 *
 * Responsibilities:
 *  • Starts/stops every agent as a cohesive fleet.
 *  • Injects shared dependencies (broadcast, db) into agents that need them.
 *  • Exposes an aggregated status() snapshot for the /agents API route.
 *  • Handles graceful shutdown on SIGTERM / SIGINT.
 */
const PricingAgent   = require('./PricingAgent');
const MatchingAgent  = require('./MatchingAgent');
const MonitoringAgent = require('./MonitoringAgent');
const BackupAgent    = require('./BackupAgent');
const RevenueAgent   = require('./RevenueAgent');
const CleanupAgent   = require('./CleanupAgent');

class AgentOrchestrator {
  constructor() {
    this.agents = [
      PricingAgent,
      MatchingAgent,
      MonitoringAgent,
      BackupAgent,
      RevenueAgent,
      CleanupAgent,
    ];
    this._started = false;
  }

  /**
   * Call once after WebSocket server is ready.
   * @param {{ broadcast: Function }} deps
   */
  start(deps = {}) {
    if (this._started) return;
    this._started = true;

    // Inject shared deps into agents that need them
    for (const agent of this.agents) {
      if (typeof agent.inject === 'function') {
        agent.inject(deps);
      }
    }

    for (const agent of this.agents) {
      agent.start();
    }

    // Graceful shutdown – store references so they can be removed if stop() is called
    this._shutdownHandler = () => {
      console.log('[Orchestrator] Graceful shutdown – stopping all agents');
      this.stop();
    };
    process.on('SIGTERM', this._shutdownHandler);
    process.on('SIGINT',  this._shutdownHandler);

    console.log(`[Orchestrator] All ${this.agents.length} agents started`);
  }

  stop() {
    for (const agent of this.agents) {
      agent.stop();
    }
    if (this._shutdownHandler) {
      process.off('SIGTERM', this._shutdownHandler);
      process.off('SIGINT',  this._shutdownHandler);
      this._shutdownHandler = null;
    }
    this._started = false;
  }

  /** Returns aggregated status for all agents */
  status() {
    return {
      orchestrator: {
        started: this._started,
        agentCount: this.agents.length,
        timestamp: new Date().toISOString(),
      },
      agents: this.agents.map((a) => a.status()),
      metrics: {
        pricing:    PricingAgent.getSurgeMultiplier?.() ?? null,
        monitoring: MonitoringAgent.getMetrics?.() ?? null,
        revenue:    RevenueAgent.getLastReport?.() ?? null,
      },
    };
  }
}

module.exports = new AgentOrchestrator();

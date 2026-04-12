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

    // Graceful shutdown
    const shutdown = () => {
      console.log('[Orchestrator] Graceful shutdown – stopping all agents');
      this.stop();
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT',  shutdown);

    console.log(`[Orchestrator] All ${this.agents.length} agents started`);
  }

  stop() {
    for (const agent of this.agents) {
      agent.stop();
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

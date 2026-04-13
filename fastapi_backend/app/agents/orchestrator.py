"""
AgentOrchestrator — Python FastAPI edition
Author : LIORVYS GUARDIOLA
Code   : 7039
"""
from datetime import datetime

from app.agents.pricing_agent import pricing_agent
from app.agents.matching_agent import matching_agent
from app.agents.monitoring_agent import monitoring_agent
from app.agents.revenue_agent import revenue_agent


class AgentOrchestrator:
    def __init__(self):
        self._agents = [pricing_agent, matching_agent, monitoring_agent, revenue_agent]
        self._started = False

    def start(self):
        if self._started:
            return
        self._started = True
        for agent in self._agents:
            agent.start()
        print(f"[Orchestrator] All {len(self._agents)} agents started")

    def stop(self):
        for agent in self._agents:
            agent.stop()
        self._started = False

    def status(self) -> dict:
        return {
            "orchestrator": {
                "started": self._started,
                "agent_count": len(self._agents),
                "timestamp": datetime.utcnow().isoformat(),
            },
            "agents": [a.status() for a in self._agents],
            "metrics": {
                "pricing": pricing_agent.get_surge_multiplier(),
                "monitoring": monitoring_agent.get_metrics(),
                "revenue": revenue_agent.get_last_report(),
            },
        }


orchestrator = AgentOrchestrator()

"""
AgentOrchestrator – single control point for all autonomous AI agents.

Responsible for:
  • Starting / stopping every agent as a cohesive fleet.
  • Providing an aggregated status snapshot for the /agents API.
  • Handling graceful shutdown.
"""
import asyncio
from typing import Optional

from app.agents.analytics_agent import AnalyticsAgent
from app.agents.matching_agent import MatchingAgent
from app.agents.monitoring_agent import MonitoringAgent
from app.agents.pricing_agent import PricingAgent
from app.agents.revenue_agent import RevenueAgent
from app.agents.security_agent import SecurityAgent
from app.utils.logger import get_logger

logger = get_logger(__name__)


class AgentOrchestrator:
    def __init__(self) -> None:
        self.pricing = PricingAgent()
        self.matching = MatchingAgent()
        self.monitoring = MonitoringAgent()
        self.revenue = RevenueAgent()
        self.analytics = AnalyticsAgent()
        self.security = SecurityAgent()

        self._agents = [
            self.pricing,
            self.matching,
            self.monitoring,
            self.revenue,
            self.analytics,
            self.security,
        ]
        self._started = False

    async def start(self) -> None:
        if self._started:
            return
        self._started = True
        for agent in self._agents:
            await agent.start()
        logger.info("orchestrator.started", agent_count=len(self._agents))

    async def stop(self) -> None:
        if not self._started:
            return
        await asyncio.gather(*[agent.stop() for agent in self._agents])
        self._started = False
        logger.info("orchestrator.stopped")

    def status(self) -> dict:
        return {
            "orchestrator": {
                "started": self._started,
                "agent_count": len(self._agents),
            },
            "agents": [a.status() for a in self._agents],
            "metrics": {
                "surge_multiplier": self.pricing.get_current_multiplier(),
                "last_health": self.monitoring.get_last_snapshot(),
                "last_revenue_report": self.revenue.get_last_report(),
                "last_analytics": self.analytics.get_last_snapshot(),
                "security_stats": self.security.get_stats(),
            },
        }


# Singleton instance – imported by the FastAPI app lifespan
orchestrator = AgentOrchestrator()

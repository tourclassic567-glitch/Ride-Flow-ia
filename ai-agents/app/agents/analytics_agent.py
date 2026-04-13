"""
AnalyticsAgent – generates actionable insights from platform data.

Reads aggregated counters from Redis, produces a snapshot of KPIs,
and optionally uses an LLM to surface natural-language insights.
"""
import time

from app.agents.base_agent import BaseAgent
from app.config import get_settings
from app.redis_client import get_value, set_value


class AnalyticsAgent(BaseAgent):
    def __init__(self) -> None:
        settings = get_settings()
        super().__init__("AnalyticsAgent", settings.analytics_agent_interval)
        self._last_snapshot: dict = {}
        self._llm = self._build_llm()

    def _build_llm(self):
        settings = get_settings()
        if not settings.openai_api_key:
            return None
        try:
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(
                model=settings.openai_model,
                temperature=0.3,
                api_key=settings.openai_api_key,
            )
        except Exception:
            return None

    async def tick(self) -> None:
        kpis = await self._collect_kpis()
        insight = await self._generate_insight(kpis)

        snapshot = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "kpis": kpis,
            "insight": insight,
        }
        self._last_snapshot = snapshot
        await set_value("analytics:snapshot", snapshot, ttl=self.interval_seconds * 3)
        self.logger.info("analytics.snapshot", kpis=kpis)
        await self.emit("analytics_snapshot", snapshot)

    async def _collect_kpis(self) -> dict:
        keys = [
            "rides:requested_count",
            "rides:matched_count",
            "rides:completed_count",
            "rides:cancelled_count",
            "revenue:total_usd",
            "pricing:surge_multiplier",
        ]
        values = {}
        for key in keys:
            val = await get_value(key)
            short_key = key.split(":")[-1]
            values[short_key] = float(val) if val is not None else 0.0
        return values

    async def _generate_insight(self, kpis: dict) -> str:
        if self._llm is None:
            return self._rule_based_insight(kpis)
        try:
            from langchain.schema import HumanMessage
            prompt = (
                "You are an analytics assistant for a ride-sharing platform. "
                f"KPIs: {kpis}. "
                "Provide ONE concise (max 2 sentences) actionable insight."
            )
            result = await self._llm.ainvoke([HumanMessage(content=prompt)])
            return result.content.strip()
        except Exception as exc:
            self.logger.warning("analytics.ai_fallback", error=str(exc))
            return self._rule_based_insight(kpis)

    @staticmethod
    def _rule_based_insight(kpis: dict) -> str:
        surge = kpis.get("surge_multiplier", 1.0)
        completed = kpis.get("completed_count", 0)
        cancelled = kpis.get("cancelled_count", 0)
        total = completed + cancelled
        cancellation_rate = (cancelled / total * 100) if total > 0 else 0

        if surge > 1.5:
            return f"High demand detected (surge {surge}x). Consider onboarding more drivers."
        if cancellation_rate > 20:
            return f"Cancellation rate is {cancellation_rate:.1f}%. Investigate driver availability."
        return f"Platform healthy: {int(completed)} rides completed, surge at {surge}x."

    def get_last_snapshot(self) -> dict:
        return self._last_snapshot

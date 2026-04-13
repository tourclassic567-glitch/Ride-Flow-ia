"""
PricingAgent – AI-driven dynamic surge pricing.

Uses LangChain to analyse demand signals from Redis and adjusts the
surge multiplier accordingly.  Falls back to a rule-based heuristic
when no OpenAI key is configured.
"""
import random

from app.agents.base_agent import BaseAgent
from app.config import get_settings
from app.redis_client import get_value, set_value
from app.services.metrics import surge_multiplier

SURGE_KEY = "pricing:surge_multiplier"
DEMAND_KEY = "pricing:demand_score"


class PricingAgent(BaseAgent):
    def __init__(self) -> None:
        settings = get_settings()
        super().__init__("PricingAgent", settings.pricing_agent_interval)
        self._current_multiplier: float = 1.0
        self._llm = self._build_llm()

    def _build_llm(self):
        settings = get_settings()
        if not settings.openai_api_key:
            return None
        try:
            from langchain_openai import ChatOpenAI
            return ChatOpenAI(
                model=settings.openai_model,
                temperature=0,
                api_key=settings.openai_api_key,
            )
        except Exception:
            return None

    async def tick(self) -> None:
        demand_score = await self._get_demand_score()
        multiplier = await self._calculate_multiplier(demand_score)
        self._current_multiplier = multiplier

        await set_value(SURGE_KEY, multiplier, ttl=self.interval_seconds * 2)
        surge_multiplier.set(multiplier)

        self.logger.info(
            "pricing.updated",
            demand_score=demand_score,
            surge_multiplier=multiplier,
        )
        await self.emit("pricing_updated", {"surge_multiplier": multiplier, "demand_score": demand_score})

    async def _get_demand_score(self) -> float:
        """Return demand score from Redis, defaulting to a simulated value."""
        score = await get_value(DEMAND_KEY)
        if score is not None:
            return float(score)
        # Simulate demand fluctuation for demonstration
        return round(random.uniform(0.2, 0.95), 2)

    async def _calculate_multiplier(self, demand_score: float) -> float:
        if self._llm is not None:
            return await self._ai_multiplier(demand_score)
        return self._rule_based_multiplier(demand_score)

    async def _ai_multiplier(self, demand_score: float) -> float:
        """Ask the LLM to recommend a surge multiplier."""
        try:
            from langchain.schema import HumanMessage
            prompt = (
                f"You are a dynamic pricing engine for a ride-sharing platform. "
                f"Current demand score (0-1): {demand_score}. "
                f"Respond with ONLY a decimal number between 1.0 and 3.0 representing "
                f"the appropriate surge multiplier. No explanation."
            )
            result = await self._llm.ainvoke([HumanMessage(content=prompt)])
            multiplier = float(result.content.strip())
            return round(max(1.0, min(3.0, multiplier)), 2)
        except Exception as exc:
            self.logger.warning("pricing.ai_fallback", error=str(exc))
            return self._rule_based_multiplier(demand_score)

    @staticmethod
    def _rule_based_multiplier(demand_score: float) -> float:
        if demand_score < 0.3:
            return 1.0
        if demand_score < 0.6:
            return round(1.0 + demand_score * 0.5, 2)
        if demand_score < 0.85:
            return round(1.3 + (demand_score - 0.6) * 1.5, 2)
        return min(3.0, round(1.67 + (demand_score - 0.85) * 8.0, 2))

    def get_current_multiplier(self) -> float:
        return self._current_multiplier

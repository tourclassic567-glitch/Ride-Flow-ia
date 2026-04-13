"""
MatchingAgent – AI-powered ride-to-driver matching.

Polls Redis for pending ride requests and available drivers, scores
candidates, and emits match events.  Uses an LLM for quality-score
refinement when OpenAI is configured.
"""
import json
import time
from typing import Optional

from app.agents.base_agent import BaseAgent
from app.config import get_settings
from app.redis_client import delete_key, get_redis, set_value
from app.services.metrics import rides_matched_total, active_drivers, active_passengers

PENDING_RIDES_KEY = "matching:pending_rides"
AVAILABLE_DRIVERS_KEY = "matching:available_drivers"
MATCH_RESULT_PREFIX = "matching:result:"


class MatchingAgent(BaseAgent):
    def __init__(self) -> None:
        settings = get_settings()
        super().__init__("MatchingAgent", settings.matching_agent_interval)
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
        r = await get_redis()
        pending_raw = await r.lrange(PENDING_RIDES_KEY, 0, -1)
        drivers_raw = await r.lrange(AVAILABLE_DRIVERS_KEY, 0, -1)

        pending_rides = [json.loads(p) for p in pending_raw]
        available_drivers = [json.loads(d) for d in drivers_raw]

        active_passengers.set(len(pending_rides))
        active_drivers.set(len(available_drivers))

        if not pending_rides or not available_drivers:
            return

        matched = 0
        for ride in pending_rides:
            driver = await self._pick_best_driver(ride, available_drivers)
            if driver is None:
                continue

            result = {
                "ride_id": ride.get("ride_id"),
                "driver_id": driver.get("driver_id"),
                "matched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "estimated_arrival_minutes": driver.get("eta_minutes", 5),
            }
            await set_value(
                f"{MATCH_RESULT_PREFIX}{ride['ride_id']}",
                result,
                ttl=300,
            )
            available_drivers.remove(driver)
            rides_matched_total.inc()
            matched += 1

            await self.emit("ride_matched", result)

        if matched:
            self.logger.info("matching.completed", matched=matched)

    async def _pick_best_driver(
        self, ride: dict, drivers: list[dict]
    ) -> Optional[dict]:
        if not drivers:
            return None
        if self._llm is not None:
            return await self._ai_pick(ride, drivers)
        return self._closest_driver(ride, drivers)

    async def _ai_pick(self, ride: dict, drivers: list[dict]) -> Optional[dict]:
        try:
            from langchain.schema import HumanMessage
            context = (
                f"Ride request: {json.dumps(ride)}\n"
                f"Available drivers: {json.dumps(drivers[:5])}\n"
                "Return ONLY the driver_id of the best match as a plain string."
            )
            result = await self._llm.ainvoke([HumanMessage(content=context)])
            driver_id = result.content.strip()
            for d in drivers:
                if str(d.get("driver_id")) == driver_id:
                    return d
        except Exception as exc:
            self.logger.warning("matching.ai_fallback", error=str(exc))
        return self._closest_driver(ride, drivers)

    @staticmethod
    def _closest_driver(ride: dict, drivers: list[dict]) -> Optional[dict]:
        """Simple heuristic: driver with lowest eta_minutes."""
        if not drivers:
            return None
        return min(drivers, key=lambda d: d.get("eta_minutes", 999))

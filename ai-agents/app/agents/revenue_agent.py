"""
RevenueAgent – tracks and reports on revenue metrics.

Aggregates ride completion data from Redis counters, calculates
daily/hourly revenue, and publishes summary reports.
"""
import time

from app.agents.base_agent import BaseAgent
from app.config import get_settings
from app.redis_client import get_value, set_value
from app.services.metrics import revenue_total_usd


class RevenueAgent(BaseAgent):
    def __init__(self) -> None:
        settings = get_settings()
        super().__init__("RevenueAgent", settings.revenue_agent_interval)
        self._last_report: dict = {}

    async def tick(self) -> None:
        total_revenue = await self._fetch_total_revenue()
        hourly_revenue = await self._fetch_hourly_revenue()
        rides_count = await self._fetch_rides_count()

        avg_fare = (total_revenue / rides_count) if rides_count > 0 else 0.0

        report = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "total_revenue_usd": total_revenue,
            "hourly_revenue_usd": hourly_revenue,
            "rides_completed": rides_count,
            "average_fare_usd": round(avg_fare, 2),
        }
        self._last_report = report
        await set_value("revenue:report", report, ttl=self.interval_seconds * 4)
        revenue_total_usd.set(total_revenue)

        self.logger.info("revenue.report", **report)
        await self.emit("revenue_report", report)

    async def _fetch_total_revenue(self) -> float:
        val = await get_value("revenue:total_usd")
        return float(val) if val is not None else 0.0

    async def _fetch_hourly_revenue(self) -> float:
        val = await get_value("revenue:hourly_usd")
        return float(val) if val is not None else 0.0

    async def _fetch_rides_count(self) -> int:
        val = await get_value("rides:completed_count")
        return int(val) if val is not None else 0

    def get_last_report(self) -> dict:
        return self._last_report

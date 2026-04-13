from datetime import datetime
from app.agents.base_agent import BaseAgent
from app import database as db


class RevenueAgent(BaseAgent):
    def __init__(self):
        super().__init__("RevenueAgent", interval_seconds=300)
        self._last_report: dict = {}

    async def tick(self):
        row = await db.fetchrow(
            """SELECT COUNT(*) AS total_rides, COALESCE(SUM(price), 0) AS total_revenue
               FROM rides WHERE status = 'completed'"""
        )
        self._last_report = {
            "total_rides": int(row["total_rides"]) if row else 0,
            "total_revenue": float(row["total_revenue"]) if row else 0.0,
            "timestamp": datetime.utcnow().isoformat(),
        }
        print(f"[RevenueAgent] {self._last_report}")

    def get_last_report(self) -> dict:
        return self._last_report


revenue_agent = RevenueAgent()

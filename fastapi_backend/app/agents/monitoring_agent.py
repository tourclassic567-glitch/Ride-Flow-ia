from datetime import datetime
from app.agents.base_agent import BaseAgent
from app import database as db


class MonitoringAgent(BaseAgent):
    def __init__(self):
        super().__init__("MonitoringAgent", interval_seconds=60)
        self._metrics: dict = {}

    async def tick(self):
        online_drivers = await db.fetchrow("SELECT COUNT(*) AS cnt FROM drivers WHERE status = 'online'")
        active_rides = await db.fetchrow("SELECT COUNT(*) AS cnt FROM rides WHERE status IN ('requested','matched','in_progress')")
        self._metrics = {
            "online_drivers": int(online_drivers["cnt"]) if online_drivers else 0,
            "active_rides": int(active_rides["cnt"]) if active_rides else 0,
            "timestamp": datetime.utcnow().isoformat(),
        }
        print(f"[MonitoringAgent] {self._metrics}")

    def get_metrics(self) -> dict:
        return self._metrics


monitoring_agent = MonitoringAgent()

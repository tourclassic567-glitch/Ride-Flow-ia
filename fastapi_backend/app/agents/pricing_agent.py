from app.agents.base_agent import BaseAgent
from app import database as db


class PricingAgent(BaseAgent):
    def __init__(self):
        super().__init__("PricingAgent", interval_seconds=30)
        self.current_multiplier = 1.0

    async def tick(self):
        drivers_row = await db.fetchrow("SELECT COUNT(*) AS cnt FROM drivers WHERE status = 'online'")
        rides_row = await db.fetchrow("SELECT COUNT(*) AS cnt FROM rides WHERE status = 'requested'")

        online_drivers = max(int(drivers_row["cnt"]) if drivers_row else 1, 1)
        pending_rides = int(rides_row["cnt"]) if rides_row else 0

        demand_ratio = pending_rides / online_drivers

        if demand_ratio <= 0.5:
            surge = 1.0
        elif demand_ratio <= 1.0:
            surge = 1.0 + (demand_ratio - 0.5) * 0.8
        elif demand_ratio <= 2.0:
            surge = 1.4 + (demand_ratio - 1.0) * 0.6
        else:
            surge = min(2.0 + (demand_ratio - 2.0) * 0.25, 2.5)

        self.current_multiplier = round(surge, 2)

        try:
            await db.execute(
                """INSERT INTO demand_metrics (online_drivers, pending_rides, surge_multiplier, recorded_at)
                   VALUES ($1, $2, $3, NOW())""",
                online_drivers, pending_rides, self.current_multiplier,
            )
        except Exception:
            pass

        print(f"[PricingAgent] drivers={online_drivers} rides={pending_rides} surge={self.current_multiplier}×")

    def get_surge_multiplier(self) -> float:
        return self.current_multiplier


pricing_agent = PricingAgent()

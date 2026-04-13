import random
from app.agents.base_agent import BaseAgent
from app import database as db


class MatchingAgent(BaseAgent):
    def __init__(self):
        super().__init__("MatchingAgent", interval_seconds=15)

    async def tick(self):
        unmatched = await db.fetch(
            "SELECT id FROM rides WHERE status = 'requested' ORDER BY created_at ASC LIMIT 10"
        )
        if not unmatched:
            return

        available = await db.fetch(
            "SELECT id FROM drivers WHERE status = 'online' LIMIT 10"
        )
        if not available:
            return

        for ride in unmatched:
            driver = random.choice(available)
            await db.execute(
                "UPDATE rides SET status = 'matched', driver_id = $1 WHERE id = $2",
                driver["id"], ride["id"],
            )
            print(f"[MatchingAgent] Matched ride {ride['id']} → driver {driver['id']}")


matching_agent = MatchingAgent()

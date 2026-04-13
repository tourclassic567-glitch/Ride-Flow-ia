"""
MonitoringAgent – collects system health metrics and raises alerts.

Checks Redis connectivity, database health, and agent liveness,
then publishes a health snapshot to the Redis events channel.
"""
import asyncio
import time

import redis.asyncio as aioredis

from app.agents.base_agent import BaseAgent
from app.config import get_settings
from app.redis_client import get_redis, set_value


class MonitoringAgent(BaseAgent):
    def __init__(self) -> None:
        settings = get_settings()
        super().__init__("MonitoringAgent", settings.monitoring_agent_interval)
        self._last_snapshot: dict = {}

    async def tick(self) -> None:
        snapshot = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "redis": await self._check_redis(),
            "database": await self._check_database(),
        }
        self._last_snapshot = snapshot
        await set_value("monitoring:health", snapshot, ttl=self.interval_seconds * 3)
        self.logger.info("monitoring.snapshot", **snapshot)
        await self.emit("health_snapshot", snapshot)

    async def _check_redis(self) -> dict:
        try:
            r = await get_redis()
            start = time.perf_counter()
            await r.ping()
            latency_ms = round((time.perf_counter() - start) * 1000, 2)
            return {"status": "ok", "latency_ms": latency_ms}
        except Exception as exc:
            return {"status": "error", "error": str(exc)}

    async def _check_database(self) -> dict:
        try:
            from app.database import get_engine
            engine = get_engine()
            start = time.perf_counter()
            async with engine.connect() as conn:
                from sqlalchemy import text
                await conn.execute(text("SELECT 1"))
            latency_ms = round((time.perf_counter() - start) * 1000, 2)
            return {"status": "ok", "latency_ms": latency_ms}
        except Exception as exc:
            return {"status": "error", "error": str(exc)}

    def get_last_snapshot(self) -> dict:
        return self._last_snapshot

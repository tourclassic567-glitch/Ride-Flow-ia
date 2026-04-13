"""
BaseAgent – Abstract base class for every autonomous AI agent.

Each agent:
  • Runs on a configurable interval via APScheduler
  • Reports metrics to Prometheus
  • Publishes/subscribes events via Redis pub/sub
  • Logs all actions using structured logging
"""
import asyncio
import time
from abc import ABC, abstractmethod
from typing import Any, Optional

from app.config import get_settings
from app.redis_client import publish
from app.services.metrics import (
    agent_errors_total,
    agent_running,
    agent_tick_duration_seconds,
    agent_ticks_total,
)
from app.utils.logger import get_logger


class BaseAgent(ABC):
    """
    Abstract base class for all autonomous agents.

    Subclasses must implement ``tick()`` which contains the agent's logic.
    """

    def __init__(self, name: str, interval_seconds: int) -> None:
        self.name = name
        self.interval_seconds = interval_seconds
        self.settings = get_settings()
        self.logger = get_logger(f"agent.{name}")
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self.stats: dict[str, Any] = {
            "ticks": 0,
            "errors": 0,
            "last_tick": None,
            "last_error": None,
            "started_at": None,
        }

    # ── Abstract interface ───────────────────────────────────────────────────

    @abstractmethod
    async def tick(self) -> None:
        """Main agent logic – executed on every interval cycle."""

    # ── Lifecycle ────────────────────────────────────────────────────────────

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self.stats["started_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        agent_running.labels(agent_name=self.name).set(1)
        self.logger.info("agent.started", interval_seconds=self.interval_seconds)
        self._task = asyncio.create_task(self._loop(), name=f"agent-{self.name}")

    async def stop(self) -> None:
        if not self._running:
            return
        self._running = False
        agent_running.labels(agent_name=self.name).set(0)
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self.logger.info("agent.stopped")

    # ── Internal loop ────────────────────────────────────────────────────────

    async def _loop(self) -> None:
        while self._running:
            await self._run_tick()
            await asyncio.sleep(self.interval_seconds)

    async def _run_tick(self) -> None:
        start = time.perf_counter()
        try:
            await self.tick()
            elapsed = time.perf_counter() - start
            agent_ticks_total.labels(agent_name=self.name).inc()
            agent_tick_duration_seconds.labels(agent_name=self.name).observe(elapsed)
            self.stats["ticks"] += 1
            self.stats["last_tick"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            self.logger.debug("agent.tick_ok", elapsed_seconds=round(elapsed, 3))
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            elapsed = time.perf_counter() - start
            agent_errors_total.labels(agent_name=self.name).inc()
            self.stats["errors"] += 1
            self.stats["last_error"] = str(exc)
            self.logger.error(
                "agent.tick_error",
                error=str(exc),
                elapsed_seconds=round(elapsed, 3),
                exc_info=True,
            )

    # ── Pub/sub helpers ───────────────────────────────────────────────────────

    async def emit(self, event_type: str, payload: dict) -> None:
        """Publish an event to the agents channel via Redis."""
        message = {
            "agent": self.name,
            "event": event_type,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            **payload,
        }
        await publish("agents:events", message)

    # ── Status ────────────────────────────────────────────────────────────────

    def status(self) -> dict:
        return {
            "name": self.name,
            "running": self._running,
            "interval_seconds": self.interval_seconds,
            "stats": self.stats,
        }

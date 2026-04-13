import asyncio
from datetime import datetime


class BaseAgent:
    def __init__(self, name: str, interval_seconds: float = 30):
        self.name = name
        self.interval = interval_seconds
        self._task: asyncio.Task | None = None
        self._running = False

    def start(self):
        if self._running:
            return
        self._running = True
        self._task = asyncio.ensure_future(self._loop())

    def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            self._task = None

    async def _loop(self):
        while self._running:
            try:
                await self.tick()
            except Exception as e:
                print(f"[{self.name}] tick error: {e}")
            await asyncio.sleep(self.interval)

    async def tick(self):
        pass  # override in subclass

    def status(self) -> dict:
        return {
            "name": self.name,
            "running": self._running,
            "interval_seconds": self.interval,
            "timestamp": datetime.utcnow().isoformat(),
        }

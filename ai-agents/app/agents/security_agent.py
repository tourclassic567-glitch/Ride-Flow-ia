"""
SecurityAgent – monitors for anomalous patterns and rate-limit violations.

Scans Redis for suspicious activity counters (e.g., failed logins,
repeated payment failures) and emits security alerts when thresholds
are exceeded.
"""
import time

from app.agents.base_agent import BaseAgent
from app.config import get_settings
from app.redis_client import get_redis, set_value
from app.services.metrics import security_events_total

# Thresholds
FAILED_LOGIN_THRESHOLD = 10       # per IP within the rolling window
PAYMENT_FAILURE_THRESHOLD = 5     # per user within the rolling window
RATE_LIMIT_THRESHOLD = 100        # requests in the window


class SecurityAgent(BaseAgent):
    def __init__(self) -> None:
        settings = get_settings()
        super().__init__("SecurityAgent", settings.security_agent_interval)
        self._stats: dict = {"alerts_raised": 0, "last_scan": None}

    async def tick(self) -> None:
        alerts = []
        alerts.extend(await self._scan_failed_logins())
        alerts.extend(await self._scan_payment_failures())
        alerts.extend(await self._scan_rate_limits())

        scan_result = {
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "alerts": alerts,
            "alert_count": len(alerts),
        }
        self._stats["last_scan"] = scan_result
        self._stats["alerts_raised"] += len(alerts)

        await set_value("security:last_scan", scan_result, ttl=self.interval_seconds * 5)

        if alerts:
            self.logger.warning("security.alerts_raised", count=len(alerts), alerts=alerts)
            security_events_total.labels(event_type="alert").inc(len(alerts))
            await self.emit("security_alert", {"alerts": alerts})
        else:
            self.logger.debug("security.scan_clean")

    async def _scan_failed_logins(self) -> list[dict]:
        r = await get_redis()
        alerts = []
        keys = await r.keys("security:failed_login:*")
        for key in keys:
            count = await r.get(key)
            if count and int(count) >= FAILED_LOGIN_THRESHOLD:
                ip = key.split(":")[-1]
                alerts.append({
                    "type": "brute_force",
                    "ip": ip,
                    "failed_attempts": int(count),
                })
                security_events_total.labels(event_type="brute_force").inc()
        return alerts

    async def _scan_payment_failures(self) -> list[dict]:
        r = await get_redis()
        alerts = []
        keys = await r.keys("security:payment_failure:*")
        for key in keys:
            count = await r.get(key)
            if count and int(count) >= PAYMENT_FAILURE_THRESHOLD:
                user_id = key.split(":")[-1]
                alerts.append({
                    "type": "repeated_payment_failure",
                    "user_id": user_id,
                    "failure_count": int(count),
                })
                security_events_total.labels(event_type="payment_failure").inc()
        return alerts

    async def _scan_rate_limits(self) -> list[dict]:
        r = await get_redis()
        alerts = []
        keys = await r.keys("ratelimit:*")
        for key in keys:
            count = await r.get(key)
            if count and int(count) >= RATE_LIMIT_THRESHOLD:
                identifier = ":".join(key.split(":")[1:])
                alerts.append({
                    "type": "rate_limit_exceeded",
                    "identifier": identifier,
                    "request_count": int(count),
                })
                security_events_total.labels(event_type="rate_limit").inc()
        return alerts

    def get_stats(self) -> dict:
        return self._stats

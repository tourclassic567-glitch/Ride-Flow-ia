"""Redis client: connection pool, pub/sub helpers, and key-value utilities."""
import json
from typing import Any, Callable, Optional

import redis.asyncio as aioredis

from app.config import get_settings
from app.utils.logger import get_logger

logger = get_logger(__name__)

_redis: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        settings = get_settings()
        _redis = aioredis.from_url(
            settings.redis_url,
            max_connections=settings.redis_max_connections,
            decode_responses=True,
        )
    return _redis


async def close_redis() -> None:
    global _redis
    if _redis:
        await _redis.aclose()
        _redis = None
    logger.info("redis.closed")


async def publish(channel: str, message: dict) -> None:
    """Publish a JSON message to a Redis pub/sub channel."""
    r = await get_redis()
    payload = json.dumps(message)
    await r.publish(channel, payload)
    logger.debug("redis.publish", channel=channel)


async def subscribe(channel: str, handler: Callable[[dict], Any]) -> None:
    """Subscribe to a channel and call handler for each message."""
    r = await get_redis()
    pubsub = r.pubsub()
    await pubsub.subscribe(channel)
    logger.info("redis.subscribe", channel=channel)
    async for raw in pubsub.listen():
        if raw["type"] == "message":
            try:
                data = json.loads(raw["data"])
                await handler(data)
            except Exception as exc:
                logger.error("redis.handler_error", channel=channel, error=str(exc))


async def set_value(key: str, value: Any, ttl: Optional[int] = None) -> None:
    r = await get_redis()
    serialized = json.dumps(value) if not isinstance(value, str) else value
    if ttl:
        await r.setex(key, ttl, serialized)
    else:
        await r.set(key, serialized)


async def get_value(key: str) -> Optional[Any]:
    r = await get_redis()
    val = await r.get(key)
    if val is None:
        return None
    try:
        return json.loads(val)
    except (json.JSONDecodeError, TypeError):
        return val


async def delete_key(key: str) -> None:
    r = await get_redis()
    await r.delete(key)


async def increment(key: str, amount: int = 1) -> int:
    r = await get_redis()
    return await r.incrby(key, amount)

import asyncpg
from app.config import settings

_pool: asyncpg.Pool | None = None


async def init_db():
    global _pool
    try:
        _pool = await asyncpg.create_pool(settings.database_url, min_size=2, max_size=10)
        print("Database connected successfully")
    except Exception as e:
        print(f"Database not available – running in mock mode: {e}")
        _pool = None


async def close_db():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


async def fetch(query: str, *args):
    if _pool is None:
        return None
    async with _pool.acquire() as conn:
        return await conn.fetch(query, *args)


async def fetchrow(query: str, *args):
    if _pool is None:
        return None
    async with _pool.acquire() as conn:
        return await conn.fetchrow(query, *args)


async def execute(query: str, *args):
    if _pool is None:
        return None
    async with _pool.acquire() as conn:
        return await conn.execute(query, *args)

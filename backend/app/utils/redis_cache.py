"""Optional Redis cache helper.
Uses aioredis if REDIS_URL is provided; otherwise, functions are no-ops.
"""
import os
import asyncio
from typing import Optional

try:
    import aioredis  # type: ignore
except Exception:  # pragma: no cover
    aioredis = None  # fallback

REDIS_URL = os.getenv("REDIS_URL")
_redis = None

async def get_client():
    global _redis
    if not REDIS_URL or aioredis is None:
        return None
    if _redis is None:
        _redis = await aioredis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)
    return _redis


def feed_cache_key(user_id: int) -> str:
    return f"feed:{user_id}"


async def invalidate_all_feeds(user_ids: Optional[list[int]] = None):
    client = await get_client()
    if not client:
        return
    if user_ids:
        keys = [feed_cache_key(uid) for uid in user_ids]
        if keys:
            await client.delete(*keys)
    else:
        # Delete all feed:* keys (may be heavy in production; for now simple scan)
        cursor = "0"
        keys_to_delete = []
        while True:
            cursor, keys = await client.scan(cursor=cursor, match="feed:*", count=1000)
            keys_to_delete.extend(keys)
            if cursor == "0":
                break
        if keys_to_delete:
            await client.delete(*keys_to_delete)

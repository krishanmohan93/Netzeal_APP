"""Optional Redis cache helper.
Uses redis asyncio client if REDIS_URL is provided; otherwise, functions are no-ops.
"""
import json
from typing import Optional

from ..core.config import settings

try:
    import redis.asyncio as redis  # type: ignore
except Exception:  # pragma: no cover
    redis = None  # fallback

_redis = None

async def get_client():
    global _redis
    if not settings.REDIS_URL or redis is None:
        return None
    if _redis is None:
        _redis = redis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)
    return _redis


def feed_cache_key(user_id: int) -> str:
    return f"feed:{user_id}"


def paged_feed_cache_key(user_id: int, skip: int, limit: int) -> str:
    return f"feed:{user_id}:{skip}:{limit}"


def profile_cache_key(user_id: int) -> str:
    return f"profile:{user_id}"


async def get_cached_json(key: str):
    client = await get_client()
    if not client:
        return None
    value = await client.get(key)
    if not value:
        return None
    try:
        return json.loads(value)
    except Exception:
        return None


async def set_cached_json(key: str, value, ttl_seconds: int):
    client = await get_client()
    if not client:
        return
    await client.set(key, json.dumps(value, default=str), ex=max(1, ttl_seconds))


async def get_cache(key: str):
    """Simple cache read helper (JSON payload)."""
    return await get_cached_json(key)


async def set_cache(key: str, value, ttl: int):
    """Simple cache write helper (JSON payload)."""
    await set_cached_json(key, value, ttl)


async def invalidate_profile_cache(user_ids: list[int]):
    client = await get_client()
    if not client:
        return
    keys = [profile_cache_key(uid) for uid in user_ids if uid]
    if keys:
        await client.delete(*keys)


async def invalidate_all_feeds(user_ids: Optional[list[int]] = None):
    client = await get_client()
    if not client:
        return
    if user_ids:
        # delete all paged feed keys for those users
        keys_to_delete = []
        for uid in user_ids:
            cursor = "0"
            while True:
                cursor, keys = await client.scan(cursor=cursor, match=f"feed:{uid}:*", count=200)
                keys_to_delete.extend(keys)
                if cursor == "0":
                    break
        if keys_to_delete:
            await client.delete(*keys_to_delete)
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

from __future__ import annotations
import os
import json
import time
from typing import Optional

try:
    from redis import asyncio as aioredis
except Exception:
    aioredis = None

REDIS_URL = os.getenv("REDIS_URL")

# Fallback in-memory cache
_mem = {}


async def _get_client():
    if not REDIS_URL or aioredis is None:
        return None
    return await aioredis.from_url(REDIS_URL, encoding="utf-8", decode_responses=True)


async def cache_set(key: str, value: dict, ttl: int = 60):
    client = await _get_client()
    s = json.dumps(value)
    if client:
        await client.set(key, s, ex=ttl)
    else:
        _mem[key] = (time.time() + ttl, s)


async def cache_get(key: str) -> Optional[dict]:
    client = await _get_client()
    if client:
        s = await client.get(key)
        return json.loads(s) if s else None
    else:
        item = _mem.get(key)
        if not item:
            return None
        exp, s = item
        if time.time() > exp:
            _mem.pop(key, None)
            return None
        return json.loads(s)

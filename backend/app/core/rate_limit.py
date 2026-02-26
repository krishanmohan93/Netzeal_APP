"""
Rate limiting dependencies for FastAPI endpoints.
Uses Redis when available (distributed-safe), with in-memory fallback.
"""
from collections import defaultdict, deque
from threading import Lock
from time import monotonic
from typing import Callable

from fastapi import HTTPException, Request, status

from .config import settings

try:
    import redis.asyncio as redis
except Exception:  # pragma: no cover
    redis = None


_RATE_STATE: dict[str, deque[float]] = defaultdict(deque)
_RATE_LOCK = Lock()
_REDIS_CLIENT = None
_REDIS_INIT_ATTEMPTED = False


def _get_identifier(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _enforce_limit(key: str, limit: int, window_seconds: int) -> int | None:
    now = monotonic()
    with _RATE_LOCK:
        hits = _RATE_STATE[key]
        threshold = now - window_seconds
        while hits and hits[0] <= threshold:
            hits.popleft()

        if len(hits) >= limit:
            retry_after = max(1, int(window_seconds - (now - hits[0])))
            return retry_after

        hits.append(now)
    return None


async def _get_redis_client():
    global _REDIS_CLIENT, _REDIS_INIT_ATTEMPTED

    if _REDIS_CLIENT is not None:
        return _REDIS_CLIENT
    if _REDIS_INIT_ATTEMPTED:
        return None

    _REDIS_INIT_ATTEMPTED = True
    if not settings.REDIS_URL or redis is None:
        return None

    try:
        _REDIS_CLIENT = redis.from_url(settings.REDIS_URL, decode_responses=True)
        await _REDIS_CLIENT.ping()
        return _REDIS_CLIENT
    except Exception:
        _REDIS_CLIENT = None
        return None


async def _enforce_limit_redis(key: str, limit: int, window_seconds: int) -> int | None:
    client = await _get_redis_client()
    if client is None:
        return _enforce_limit(key, limit, window_seconds)

    try:
        current_count = await client.incr(key)
        if current_count == 1:
            await client.expire(key, window_seconds)

        if current_count > limit:
            ttl = await client.ttl(key)
            return max(1, int(ttl if ttl and ttl > 0 else window_seconds))
        return None
    except Exception:
        return _enforce_limit(key, limit, window_seconds)


def rate_limit_dependency(scope: str, limit: int, window_seconds: int) -> Callable:
    async def _dependency(request: Request) -> None:
        identifier = _get_identifier(request)
        key = f"{settings.RATE_LIMIT_KEY_PREFIX}:{scope}:{identifier}"
        retry_after = await _enforce_limit_redis(key, limit, window_seconds)
        if retry_after is not None:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests",
                headers={"Retry-After": str(retry_after)},
            )

    return _dependency


# Strict auth controls
strict_auth_rate_limit = rate_limit_dependency("auth", limit=settings.AUTH_RATE_LIMIT_PER_MINUTE, window_seconds=60)

# Content creation controls
post_create_rate_limit = rate_limit_dependency("post_create", limit=settings.POST_CREATE_RATE_LIMIT_PER_MINUTE, window_seconds=60)

# Social engagement controls (like/comment/follow)
engagement_rate_limit = rate_limit_dependency("engagement", limit=settings.ENGAGEMENT_RATE_LIMIT_PER_MINUTE, window_seconds=60)

# Chat message controls
chat_message_rate_limit = rate_limit_dependency("chat_message", limit=settings.CHAT_RATE_LIMIT_PER_MINUTE, window_seconds=60)

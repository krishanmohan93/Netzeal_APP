"""
Feature gate dependencies to safely disable incomplete/unsafe capabilities in production.
"""
from fastapi import HTTPException, status

from .config import settings


def _service_unavailable(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=message,
        headers={"Retry-After": "300"},
    )


async def require_live_streaming_enabled() -> None:
    if not settings.LIVE_STREAMING_ENABLED:
        raise _service_unavailable(
            "Live streaming is temporarily unavailable while we complete production hardening."
        )


async def require_semantic_features_enabled() -> None:
    if not settings.SEMANTIC_FEATURES_ENABLED:
        raise _service_unavailable(
            "Semantic recommendations are temporarily unavailable while we complete production hardening."
        )


async def require_experimental_ai_enabled() -> None:
    if not settings.EXPERIMENTAL_AI_ENABLED:
        raise _service_unavailable(
            "AI beta features are temporarily unavailable for production stability."
        )

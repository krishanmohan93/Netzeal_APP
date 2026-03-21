"""
Unified AI provider service with production-safe fallback behavior.
"""
import logging
from typing import Literal, Optional

import httpx

from ..core.config import settings

logger = logging.getLogger(__name__)


class AIService:
    """Unified AI service with Groq-first fallback and medium-length defaults."""

    @staticmethod
    def _provider_order() -> list[str]:
        primary = (settings.AI_PRIMARY_PROVIDER or "groq").strip().lower()
        if primary == "nvidia":
            ordered = ["nvidia", "groq"]
        elif primary == "auto":
            ordered = ["groq", "nvidia"]
        else:
            ordered = ["groq", "nvidia"]
        # Keep order stable while removing duplicates
        unique = []
        for provider in ordered:
            if provider not in unique:
                unique.append(provider)
        return unique

    @staticmethod
    def _provider_config(provider: str, mode: str) -> tuple[Optional[str], Optional[str], Optional[str]]:
        if provider == "groq":
            model = settings.GROQ_CHAT_MODEL or "llama-3.1-8b-instant"
            return settings.GROQ_API_KEY, settings.GROQ_API_BASE_URL, model
        if provider == "nvidia":
            model = settings.NVIDIA_CHAT_MODEL or "deepseek-ai/deepseek-r1"
            return settings.NVIDIA_API_KEY, settings.NVIDIA_API_BASE_URL, model
        return None, None, None

    @staticmethod
    async def _call_openai_compatible_chat(
        *,
        api_key: str,
        base_url: str,
        model: str,
        messages: list[dict[str, str]],
        temperature: float,
        max_tokens: int,
    ) -> str:
        url = f"{base_url.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False,
        }

        timeout = settings.AI_REQUEST_TIMEOUT_SECONDS or 30
        async with httpx.AsyncClient(timeout=float(timeout)) as client:
            response = await client.post(url, headers=headers, json=payload)
            response.raise_for_status()

        data = response.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        return (content or "").strip()

    @staticmethod
    async def generate_ai_response(
        prompt: str,
        mode: Literal["free", "deep"] = "free",
        system_prompt: Optional[str] = None,
        temperature: float = 0.65,
        max_tokens: int = 280,
    ) -> str:
        """Generate AI response using configured provider fallback order."""
        if not prompt or not prompt.strip():
            raise ValueError("Prompt cannot be empty")
        if mode not in {"free", "deep"}:
            raise ValueError(f"Invalid mode: {mode}. Use 'free' or 'deep'")

        # Keep AI answers concise/medium and avoid over-generation.
        token_cap = settings.AI_MAX_RESPONSE_TOKENS if settings.AI_MAX_RESPONSE_TOKENS > 0 else 320
        bounded_max_tokens = max(64, min(max_tokens, token_cap))

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        provider_errors: list[str] = []

        for provider in AIService._provider_order():
            api_key, base_url, model = AIService._provider_config(provider, mode)
            if not api_key or not base_url or not model:
                provider_errors.append(f"{provider}: missing configuration")
                continue
            try:
                response_text = await AIService._call_openai_compatible_chat(
                    api_key=api_key,
                    base_url=base_url,
                    model=model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=bounded_max_tokens,
                )
                if response_text:
                    return AIService._enforce_medium_length(response_text)
                provider_errors.append(f"{provider}: empty response")
            except httpx.HTTPStatusError as e:
                status_code = e.response.status_code
                provider_errors.append(f"{provider}: http_{status_code}")
                logger.warning("AI provider %s HTTP error %s", provider, status_code)
                continue
            except httpx.TimeoutException:
                provider_errors.append(f"{provider}: timeout")
                logger.warning("AI provider %s timeout", provider)
                continue
            except Exception as e:
                provider_errors.append(f"{provider}: unexpected_error")
                logger.exception("AI provider %s failure: %s", provider, e)
                continue

        logger.error("All AI providers failed: %s", "; ".join(provider_errors))
        raise ValueError("AI service temporarily unavailable.")

    @staticmethod
    def _enforce_medium_length(text: str, max_words: int = 170) -> str:
        clean = (text or "").strip()
        if not clean:
            return clean
        words = clean.split()
        if len(words) <= max_words:
            return clean
        return " ".join(words[:max_words]).rstrip(" ,;:.") + "..."

    @staticmethod
    async def generate_caption(text: str, premium: bool = False) -> str:
        """Generate concise professional caption."""
        system_prompt = (
            "You are a social media expert for a professional developer network. "
            "Return a concise caption: 2-3 short sentences and 3-5 relevant hashtags."
        )
        mode = "deep" if premium else "free"
        return await AIService.generate_ai_response(
            prompt=f"Create a social media caption for: {text}",
            mode=mode,
            system_prompt=system_prompt,
            temperature=0.7,
            max_tokens=150,
        )

    @staticmethod
    async def extract_hashtags(caption: str) -> list[str]:
        """Extract hashtags as normalized list without #."""
        system_prompt = (
            "You are a hashtag extractor. Return only comma-separated hashtags without #. "
            "Maximum 8 tags."
        )
        response = await AIService.generate_ai_response(
            prompt=f"Extract hashtags for this caption: {caption}",
            mode="free",
            system_prompt=system_prompt,
            temperature=0.2,
            max_tokens=80,
        )
        tags = [tag.strip().replace("#", "") for tag in response.split(",")]
        return [tag for tag in tags if tag][:8]


ai_service = AIService()

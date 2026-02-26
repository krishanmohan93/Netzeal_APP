"""
Unified AI Provider Service powered by NVIDIA Integrate (OpenAI-compatible API).
"""
import httpx
import logging
from typing import Literal, Optional
from ..core.config import settings

logger = logging.getLogger(__name__)


class AIService:
    """Unified AI service powered by NVIDIA Integrate."""


    @staticmethod
    async def generate_ai_response(
        prompt: str,
        mode: Literal["free", "deep"] = "free",
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 500
    ) -> str:
        """Generate AI response via NVIDIA Integrate.

        `mode` is retained for backward compatibility and can be used to choose
        between model variants later, but currently both map to NVIDIA chat model.
        """
        if not prompt or not prompt.strip():
            raise ValueError("Prompt cannot be empty")

        if mode not in {"free", "deep"}:
            raise ValueError(f"Invalid mode: {mode}. Use 'free' or 'deep'")

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        try:
            url = f"{settings.NVIDIA_API_BASE_URL.rstrip('/')}/chat/completions"
            headers = {
                "Authorization": f"Bearer {settings.NVIDIA_API_KEY}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": settings.NVIDIA_CHAT_MODEL,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "stream": False,
            }

            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()

            data = response.json()
            content = data["choices"][0]["message"]["content"]
            return (content or "").strip()
        except httpx.HTTPStatusError as e:
            logger.error("NVIDIA Integrate HTTP error: %s - %s", e.response.status_code, e.response.text)
            if e.response.status_code == 401:
                raise ValueError("AI authentication failed. Check NVIDIA API key.")
            if e.response.status_code == 429:
                raise ValueError("AI rate limit exceeded. Please try again shortly.")
            raise ValueError("AI service temporarily unavailable.")
        except httpx.TimeoutException:
            logger.error("NVIDIA Integrate timeout")
            raise ValueError("AI service timeout. Please try again.")
        except Exception as e:
            logger.exception("NVIDIA Integrate AI error: %s", e)
            raise ValueError("AI service temporarily unavailable.")
    
    @staticmethod
    async def generate_caption(text: str, premium: bool = False) -> str:
        """
        Generate an engaging social media caption
        
        Args:
            text: Post content or topic
            premium: Backward-compatible flag; routed to NVIDIA model
            
        Returns:
            Generated caption with hashtags
        """
        system_prompt = (
            "You are a social media expert creating engaging captions for a professional developer network. "
            "Create a concise, compelling caption (2-3 sentences max) with 3-5 relevant hashtags. "
            "Make it professional yet approachable."
        )
        
        prompt = f"Create a social media caption for: {text}"
        mode = "deep" if premium else "free"
        
        return await AIService.generate_ai_response(
            prompt=prompt,
            mode=mode,
            system_prompt=system_prompt,
            temperature=0.8,
            max_tokens=150
        )
    
    @staticmethod
    async def extract_hashtags(caption: str) -> list[str]:
        """
        Extract or suggest hashtags from caption
        
        Args:
            caption: Social media caption text
            
        Returns:
            List of hashtag strings (without #)
        """
        system_prompt = (
            "You are a hashtag extraction tool. Given a caption, return ONLY a comma-separated list of "
            "relevant hashtags (without # symbol). Max 8 tags. Example output: python, webdev, coding, tech"
        )
        
        prompt = f"Extract hashtags for this caption: {caption}"
        
        response = await AIService.generate_ai_response(
            prompt=prompt,
            mode="free",
            system_prompt=system_prompt,
            temperature=0.3,
            max_tokens=100
        )
        
        # Parse comma-separated tags
        tags = [tag.strip().replace("#", "") for tag in response.split(",")]
        return [tag for tag in tags if tag][:8]  # Max 8 tags


# Global instance
ai_service = AIService()

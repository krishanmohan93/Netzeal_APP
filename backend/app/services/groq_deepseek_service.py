"""
Dual AI Provider Service: Groq (Free) + DeepSeek Direct API (Premium)
Production-ready async service with error handling and timeouts
"""
import httpx
import logging
from typing import Literal, Optional
from ..core.config import settings

logger = logging.getLogger(__name__)

# Model configurations
GROQ_MODEL = "llama-3.1-8b-instant"
DEEPSEEK_MODEL = "deepseek-chat"  # Direct DeepSeek API model
TIMEOUT = 5.0  # seconds


class AIService:
    """Unified AI service supporting both Groq (free) and DeepSeek (premium)"""
    
    @staticmethod
    async def generate_ai_response(
        prompt: str,
        mode: Literal["free", "deep"] = "free",
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 500
    ) -> str:
        """
        Generate AI response using either Groq (free) or DeepSeek (premium)
        
        Args:
            prompt: User's input text
            mode: "free" for Groq Llama-3.1-8B or "deep" for DeepSeek
            system_prompt: Optional system context
            temperature: Randomness (0.0-1.0)
            max_tokens: Max response length
            
        Returns:
            AI-generated text response
            
        Raises:
            ValueError: Invalid mode or empty prompt
            httpx.TimeoutException: Request timeout
            httpx.HTTPStatusError: API error (rate limit, auth, etc.)
        """
        if not prompt or not prompt.strip():
            raise ValueError("Prompt cannot be empty")
        
        if mode == "free":
            return await AIService._call_groq(prompt, system_prompt, temperature, max_tokens)
        elif mode == "deep":
            return await AIService._call_deepseek(prompt, system_prompt, temperature, max_tokens)
        else:
            raise ValueError(f"Invalid mode: {mode}. Use 'free' or 'deep'")
    
    @staticmethod
    async def _call_groq(
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int
    ) -> str:
        """Call Groq API (free Llama-3.1-8B)"""
        url = "https://api.groq.com/openai/v1/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.GROQ_API_KEY}",
            "Content-Type": "application/json"
        }
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        payload = {
            "model": GROQ_MODEL,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens
        }
        
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"].strip()
                
        except httpx.TimeoutException:
            logger.error("Groq API timeout")
            raise ValueError("AI service timeout. Please try again.")
        except httpx.HTTPStatusError as e:
            logger.error(f"Groq API error: {e.response.status_code} - {e.response.text}")
            if e.response.status_code == 429:
                raise ValueError("Rate limit exceeded. Please wait a moment and try again.")
            elif e.response.status_code == 401:
                raise ValueError("AI service authentication failed.")
            else:
                raise ValueError(f"AI service error: {e.response.status_code}")
        except Exception as e:
            logger.exception(f"Unexpected Groq error: {e}")
            raise ValueError("AI service temporarily unavailable.")
    
    @staticmethod
    async def _call_deepseek(
        prompt: str,
        system_prompt: Optional[str],
        temperature: float,
        max_tokens: int
    ) -> str:
        """Call DeepSeek Direct API (premium)"""
        url = "https://api.deepseek.com/chat/completions"
        headers = {
            "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
            "Content-Type": "application/json"
        }
        
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        
        payload = {
            "model": DEEPSEEK_MODEL,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": False
        }
        
        try:
            async with httpx.AsyncClient(timeout=TIMEOUT) as client:
                response = await client.post(url, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
                return data["choices"][0]["message"]["content"].strip()
                
        except httpx.TimeoutException:
            logger.error("DeepSeek API timeout")
            raise ValueError("DeepSeek AI service timeout. Please try again.")
        except httpx.HTTPStatusError as e:
            logger.error(f"DeepSeek API error: {e.response.status_code} - {e.response.text}")
            if e.response.status_code == 429:
                raise ValueError("DeepSeek rate limit exceeded. Please wait a moment.")
            elif e.response.status_code == 402:
                raise ValueError("Insufficient DeepSeek credits.")
            elif e.response.status_code == 401:
                raise ValueError("DeepSeek authentication failed. Check API key.")
            else:
                raise ValueError(f"DeepSeek AI error: {e.response.status_code}")
        except Exception as e:
            logger.exception(f"Unexpected DeepSeek error: {e}")
            raise ValueError("DeepSeek AI service temporarily unavailable.")
    
    @staticmethod
    async def generate_caption(text: str, premium: bool = False) -> str:
        """
        Generate an engaging social media caption
        
        Args:
            text: Post content or topic
            premium: Use DeepSeek if True, else Groq
            
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
        Extract or suggest hashtags from caption (using free Groq)
        
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

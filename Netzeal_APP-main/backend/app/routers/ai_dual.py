"""
AI Router - Dual provider endpoints (Groq Free + DeepSeek Premium)
"""
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Literal, Optional
import logging

from ..services.groq_deepseek_service import ai_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai-dual", tags=["AI Dual Provider"])


# Request/Response Schemas
class ChatRequest(BaseModel):
    """Chat request with mode selection"""
    prompt: str = Field(..., min_length=1, max_length=2000, description="User's message")
    mode: Literal["free", "deep"] = Field(default="free", description="AI provider: free (Groq) or deep (DeepSeek)")
    system_prompt: Optional[str] = Field(default=None, max_length=1000, description="Optional system context")


class ChatResponse(BaseModel):
    """AI chat response"""
    response: str
    mode: str
    model: str


class CaptionRequest(BaseModel):
    """Caption generation request"""
    text: str = Field(..., min_length=1, max_length=1000, description="Post content or topic")
    premium: bool = Field(default=False, description="Use premium DeepSeek model")


class CaptionResponse(BaseModel):
    """Generated caption response"""
    caption: str
    mode: str


class TagsRequest(BaseModel):
    """Hashtag extraction request"""
    text: str = Field(..., min_length=1, max_length=2000, description="Caption or post content")


class TagsResponse(BaseModel):
    """Extracted hashtags"""
    tags: list[str]
    count: int


# Routes
@router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(request: ChatRequest):
    """
    Chat with AI using either Groq (free) or DeepSeek (premium)
    
    - **mode="free"**: Groq Llama-3.1-8B (fast, free, unlimited)
    - **mode="deep"**: DeepSeek via OpenRouter (premium, advanced reasoning)
    """
    try:
        response_text = await ai_service.generate_ai_response(
            prompt=request.prompt,
            mode=request.mode,
            system_prompt=request.system_prompt
        )
        
        model_name = "llama-3.1-8b-instant" if request.mode == "free" else "deepseek/deepseek-chat"
        
        return ChatResponse(
            response=response_text,
            mode=request.mode,
            model=model_name
        )
        
    except ValueError as e:
        # Business logic errors (rate limit, timeout, invalid input)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception(f"Unexpected chat error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="AI service error. Please try again later."
        )


@router.post("/caption", response_model=CaptionResponse)
async def generate_caption(request: CaptionRequest):
    """
    Generate an engaging social media caption
    
    - **premium=false**: Uses Groq (free, fast)
    - **premium=true**: Uses DeepSeek (premium, more creative)
    """
    try:
        caption = await ai_service.generate_caption(
            text=request.text,
            premium=request.premium
        )
        
        mode = "deep" if request.premium else "free"
        
        return CaptionResponse(
            caption=caption,
            mode=mode
        )
        
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception(f"Caption generation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Caption service error. Please try again."
        )


@router.post("/tags", response_model=TagsResponse)
async def extract_hashtags(request: TagsRequest):
    """
    Extract relevant hashtags from caption or post content (uses free Groq)
    
    Returns up to 8 relevant hashtags without # symbol
    """
    try:
        tags = await ai_service.extract_hashtags(request.text)
        
        return TagsResponse(
            tags=tags,
            count=len(tags)
        )
        
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception(f"Hashtag extraction error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Hashtag service error. Please try again."
        )


@router.get("/providers", response_model=dict)
async def get_providers():
    """Get information about available AI providers"""
    return {
        "providers": [
            {
                "name": "Groq",
                "mode": "free",
                "model": "llama-3.1-8b-instant",
                "features": ["Fast responses", "Unlimited requests", "Good quality"],
                "use_cases": ["General chat", "Quick captions", "Hashtag extraction"]
            },
            {
                "name": "DeepSeek (OpenRouter)",
                "mode": "deep",
                "model": "deepseek/deepseek-chat",
                "features": ["Advanced reasoning", "Premium quality", "Better creativity"],
                "use_cases": ["Premium captions", "Complex queries", "High-quality content"]
            }
        ],
        "default": "free"
    }

"""
AI and recommendation schemas
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime


class ChatMessage(BaseModel):
    """Schema for AI chat message"""
    message: str = Field(..., min_length=1, max_length=2000)


class ChatResponse(BaseModel):
    """Schema for AI chat response"""
    response: str
    intent: Optional[str] = None
    # Back-compat: generic recommendations (e.g., courses)
    recommendations: Optional[List[Dict]] = None
    # New structured recommendation channels
    recommendations_content: Optional[List[Dict]] = None
    recommendations_users: Optional[List[Dict]] = None
    recommendations_opportunities: Optional[List[Dict]] = None
    created_at: datetime


class RecommendationRequest(BaseModel):
    """Schema for requesting recommendations"""
    user_id: int
    limit: int = Field(default=10, ge=1, le=50)
    recommendation_type: str = Field(
        default="content",
        description="Type: 'content', 'users', 'courses'"
    )


class RecommendationResponse(BaseModel):
    """Schema for recommendation response"""
    type: str
    items: List[Dict]
    reasoning: Optional[str] = None


class UserAnalytics(BaseModel):
    """Schema for user analytics and insights"""
    user_id: int
    total_posts: int
    total_likes: int
    total_comments: int
    total_views: int
    engagement_rate: float
    top_topics: List[str]
    learning_progress: Dict
    skill_development: List[Dict]
    created_at: datetime
    
    class Config:
        from_attributes = True

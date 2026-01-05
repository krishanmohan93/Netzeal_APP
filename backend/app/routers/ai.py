"""
AI assistant and recommendations routes
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Dict

from ..core.database import get_db
from ..core.security import get_current_user
from ..models import User
from ..schemas.ai import (
    ChatMessage,
    ChatResponse,
    RecommendationRequest,
    RecommendationResponse,
    UserAnalytics
)
from ..services.groq_deepseek_service import AIService
from ..services.recommendation_service import recommendation_service
from ..models.social import AIConversation
from datetime import datetime

router = APIRouter(prefix="/ai", tags=["AI & Recommendations"])


@router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(
    message: ChatMessage,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Chat with AI assistant"""
    
    # Build user context (enriched with behavior summary)
    behavior = recommendation_service.summarize_user_behavior(db, current_user.id)
    user_context = {
        "skills": current_user.skills or [],
        "interests": current_user.interests or [],
        "career_stage": "Professional" if current_user.work_experience else "Entry Level",
        "recent_activity": f"Top topics: {', '.join(behavior.get('top_topics', []))}",
        "behavior": behavior,
    }
    
    # Build system prompt with user context
    system_prompt = f"""You are NetZeal AI Assistant - an intelligent tech mentor for developers.

🎯 Your Role: Help developers learn, build, connect, and grow their tech careers.

👤 Current User Profile:
- Skills: {', '.join(user_context.get('skills', [])[:5]) if user_context.get('skills') else 'Not specified'}
- Interests: {', '.join(user_context.get('interests', [])[:5]) if user_context.get('interests') else 'Not specified'}
- Career Stage: {user_context.get('career_stage', 'Unknown')}
- Recent Activity: {user_context.get('recent_activity', 'No recent activity')}

✨ Response Style: Be concise, encouraging, actionable. Tailor to user's profile."""

    # Get recent conversation history
    recent_conversations = db.query(AIConversation).filter(
        AIConversation.user_id == current_user.id
    ).order_by(AIConversation.created_at.desc()).limit(3).all()
    
    conversation_context = ""
    for conv in reversed(recent_conversations):
        conversation_context += f"User: {conv.message}\nAssistant: {conv.response}\n\n"
    
    # Build full prompt with context
    full_prompt = f"""{system_prompt}

Previous conversation:
{conversation_context if conversation_context else "No previous conversation"}

Current message: {message.message}

Respond naturally and helpfully based on the user's profile and conversation history."""

    try:
        # Use Groq (free) for chat - faster and no API key issues
        ai_response_text = await AIService.generate_ai_response(
            prompt=full_prompt,
            mode="free",  # Use free Groq
            temperature=0.7,
            max_tokens=500
        )
        
        # Detect intent from message
        intent = _detect_intent(message.message)
        
    except Exception as e:
        # Log the actual error for debugging
        import traceback
        print(f"AI Chat Error: {str(e)}")
        print(traceback.format_exc())
        
        # Fallback graceful response
        ai_response_text = (
            f"I'm having trouble right now: {str(e)[:100]}. "
            "Please try again in a moment. "
            "In the meantime, check out the recommendations below!"
        )
        intent = "general_inquiry"
    
    # Save conversation
    new_conversation = AIConversation(
        user_id=current_user.id,
        message=message.message,
        response=ai_response_text,
        intent=intent
    )
    db.add(new_conversation)
    db.commit()
    
    # Generate recommendations based on intent
    recommendations = None
    rec_content = None
    rec_users = None
    rec_opportunities = None

    try:
        if intent == "learning_recommendation":
            courses = await recommendation_service.recommend_courses(db, current_user.id)
            recommendations = courses[:3] if courses else None
        if intent in {"general_inquiry", "tech_trends", "debugging_help", "skill_development"}:
            rec_content = await recommendation_service.recommend_content_for_user(db, current_user.id, limit=6)
        if intent in {"networking", "career_advice"}:
            rec_users = await recommendation_service.recommend_users_to_follow(db, current_user.id, limit=6)
        if intent in {"project_recommendation", "career_advice"}:
            rec_opportunities = await recommendation_service.recommend_opportunities(db, current_user.id, limit=6)
    except Exception as e:
        print(f"Recommendation Error: {str(e)}")
        import traceback
        print(traceback.format_exc())
    
    return ChatResponse(
        response=ai_response_text,
        intent=intent,
        recommendations=recommendations,
        recommendations_content=rec_content,
        recommendations_users=rec_users,
        recommendations_opportunities=rec_opportunities,
        created_at=datetime.utcnow()
    )


@router.get("/recommendations/content", response_model=List[Dict])
async def get_content_recommendations(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get personalized content recommendations"""
    
    recommendations = await recommendation_service.recommend_content_for_user(
        db=db,
        user_id=current_user.id,
        limit=limit
    )
    
    return recommendations


@router.get("/recommendations/users", response_model=List[Dict])
async def get_user_recommendations(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get recommended users to follow"""
    
    recommendations = await recommendation_service.recommend_users_to_follow(
        db=db,
        user_id=current_user.id,
        limit=limit
    )
    
    return recommendations


@router.get("/recommendations/courses", response_model=List[Dict])
async def get_course_recommendations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get personalized course recommendations"""
    
    courses = await recommendation_service.recommend_courses(
        db=db,
        user_id=current_user.id
    )
    
    return courses


@router.get("/recommendations/opportunities", response_model=List[Dict])
async def get_opportunity_recommendations(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get recommended opportunities (jobs/freelance/collab derived from posts)."""
    items = await recommendation_service.recommend_opportunities(
        db=db,
        user_id=current_user.id,
        limit=limit,
    )
    return items


@router.get("/trending", response_model=List[Dict])
async def get_trending_content(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get trending content"""
    
    trending = await recommendation_service.get_trending_content(
        db=db,
        limit=limit
    )
    
    return trending


@router.get("/analytics", response_model=UserAnalytics)
async def get_user_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get user analytics and insights"""
    
    analytics = await recommendation_service.get_user_analytics(
        db=db,
        user_id=current_user.id
    )
    
    return UserAnalytics(
        **analytics,
        created_at=datetime.utcnow()
    )


@router.get("/conversations", response_model=List[Dict])
async def get_conversation_history(
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get AI conversation history"""
    
    conversations = db.query(AIConversation).filter(
        AIConversation.user_id == current_user.id
    ).order_by(AIConversation.created_at.desc()).limit(limit).all()
    
    return [
        {
            "id": conv.id,
            "message": conv.message,
            "response": conv.response,
            "intent": conv.intent,
            "created_at": conv.created_at.isoformat()
        }
        for conv in conversations
    ]


# Helper function for intent detection
def _detect_intent(message: str) -> str:
    """Detect user intent from message"""
    message_lower = message.lower()
    
    # Learning & Education
    if any(word in message_lower for word in ['course', 'learn', 'study', 'education', 'tutorial', 'resource', 'path']):
        return "learning_recommendation"
    # Career & Jobs
    elif any(word in message_lower for word in ['career', 'job', 'work', 'profession', 'resume', 'portfolio', 'interview']):
        return "career_advice"
    # Skills & Development
    elif any(word in message_lower for word in ['skill', 'improve', 'develop', 'practice', 'master']):
        return "skill_development"
    # Projects & Building
    elif any(word in message_lower for word in ['project', 'build', 'create', 'idea', 'app', 'website']):
        return "project_recommendation"
    # Networking & Community
    elif any(word in message_lower for word in ['network', 'connect', 'community', 'people', 'follow']):
        return "networking"
    # Debugging & Help
    elif any(word in message_lower for word in ['error', 'bug', 'debug', 'fix', 'help', 'problem', 'issue']):
        return "debugging_help"
    # Tech Trends
    elif any(word in message_lower for word in ['trend', 'new', 'latest', 'technology', 'framework', 'tool']):
        return "tech_trends"
    else:
        return "general_inquiry"

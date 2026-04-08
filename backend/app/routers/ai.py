"""
AI assistant and recommendations routes
"""
import asyncio
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List, Dict

from ..core.database import get_db
from ..core.security import get_current_user
from ..models import User, Post, UserInteraction
from ..schemas.ai import (
    ChatMessage,
    ChatResponse,
    RecommendationRequest,
    RecommendationResponse,
    UserAnalytics
)
from ..services.groq_deepseek_service import AIService
from ..services.embedding_service import EmbeddingService
from ..services.qdrant_service import QdrantService
from ..services.recommendation_service import recommendation_service
from ..models.social import AIConversation
from datetime import datetime
import logging

router = APIRouter(prefix="/ai", tags=["AI & Recommendations"])
logger = logging.getLogger(__name__)

_embedding_service = None
_embedding_init_attempted = False
_qdrant_service = None
_qdrant_init_attempted = False


def _get_embedding_service():
    global _embedding_service, _embedding_init_attempted
    if _embedding_service is not None:
        return _embedding_service
    if _embedding_init_attempted:
        return None
    _embedding_init_attempted = True
    try:
        _embedding_service = EmbeddingService()
        return _embedding_service
    except Exception as e:
        logger.warning("Embedding service unavailable for AI RAG: %s", e)
        return None


def _get_qdrant_service():
    global _qdrant_service, _qdrant_init_attempted
    if _qdrant_service is not None:
        return _qdrant_service
    if _qdrant_init_attempted:
        return None
    _qdrant_init_attempted = True
    try:
        _qdrant_service = QdrantService()
        _qdrant_service.init_posts_collection()
        return _qdrant_service
    except Exception as e:
        logger.warning("Qdrant unavailable for AI RAG: %s", e)
        return None


def _build_rag_context(user_message: str, max_items: int = 3) -> str:
    """Fetch semantically relevant posts from Qdrant and format compact context for the LLM."""
    if not user_message or not user_message.strip():
        return ""

    embedding_service = _get_embedding_service()
    qdrant_service = _get_qdrant_service()
    if not embedding_service or not qdrant_service:
        return ""

    try:
        query_vector = embedding_service.embed_query(user_message)
        if not query_vector:
            return ""

        results = qdrant_service.search_posts(query_vector=query_vector, limit=max_items)
        if not results:
            return ""

        lines = []
        for idx, point in enumerate(results[:max_items], start=1):
            payload = getattr(point, "payload", None) or {}
            caption = (payload.get("caption") or "").strip()
            if not caption:
                continue
            author = payload.get("author_username") or "unknown"
            tags = payload.get("tags") or []
            score = getattr(point, "score", None)
            tags_text = ", ".join(tags[:5]) if isinstance(tags, list) and tags else ""
            score_text = f" score={score:.3f}" if isinstance(score, (int, float)) else ""
            line = f"{idx}. @{author}: {caption}"
            if tags_text:
                line += f" | tags: {tags_text}"
            if score_text:
                line += f"{score_text}"
            lines.append(line)

        if not lines:
            return ""
        return "\n".join(lines)
    except Exception as e:
        logger.warning("Failed to build RAG context: %s", e)
        return ""


def _build_personal_memory_snapshot(db: Session, user_id: int, max_items: int = 6) -> str:
    """Build compact long-term memory from interactions and authored posts."""
    lines: list[str] = []
    try:
        recent_interactions = (
            db.query(UserInteraction)
            .filter(UserInteraction.user_id == user_id, UserInteraction.post_id.isnot(None))
            .order_by(UserInteraction.created_at.desc())
            .limit(max_items)
            .all()
        )
        for item in recent_interactions:
            post = item.post
            if not post:
                continue
            caption = (post.content or "").strip().replace("\n", " ")
            if len(caption) > 120:
                caption = caption[:120] + "..."
            lines.append(
                f"- {item.interaction_type.value} on post #{post.id}: {caption}"
            )
    except SQLAlchemyError as e:
        logger.warning("Failed to load interaction memory: %s", e)

    try:
        authored_posts = (
            db.query(Post)
            .filter(Post.author_id == user_id)
            .order_by(Post.created_at.desc())
            .limit(max_items)
            .all()
        )
        for post in authored_posts:
            caption = (post.content or "").strip().replace("\n", " ")
            if len(caption) > 120:
                caption = caption[:120] + "..."
            lines.append(
                f"- authored post #{post.id}: {caption} | likes={post.likes_count or 0}, comments={post.comments_count or 0}"
            )
    except SQLAlchemyError as e:
        logger.warning("Failed to load authored-post memory: %s", e)

    if not lines:
        return "No reliable memory snapshot available."
    return "\n".join(lines[: max_items * 2])


@router.post("/chat", response_model=ChatResponse)
async def chat_with_ai(
    message: ChatMessage,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Chat with AI assistant"""

    # Build user context (enriched with behavior summary)
    try:
        behavior = recommendation_service.summarize_user_behavior(db, current_user.id)
    except Exception as e:
        logger.warning("Behavior summary unavailable for user %s: %s", current_user.id, e)
        behavior = {
            "interaction_mix": {},
            "top_tags": [],
            "top_topics": [],
            "posting_topics": [],
            "recent_interactions_30d": 0,
        }
    memory_snapshot = _build_personal_memory_snapshot(db, current_user.id)
    user_context = {
        "skills": current_user.skills or [],
        "interests": current_user.interests or [],
        "career_stage": "Professional" if current_user.work_experience else "Entry Level",
        "recent_activity": f"Top topics: {', '.join(behavior.get('top_topics', []))}",
        "behavior": behavior,
    }

    # Build system prompt with user context
    system_prompt = f"""You are NetZeal AI Assistant, a personalized tech career mentor.

Core goals:
1) Guide user's career progression.
2) Suggest relevant networking connections (LinkedIn-style).
3) Suggest realistic projects and skill-building next actions.

Current user profile:
- Skills: {', '.join(user_context.get('skills', [])[:8]) if user_context.get('skills') else 'Not specified'}
- Interests: {', '.join(user_context.get('interests', [])[:8]) if user_context.get('interests') else 'Not specified'}
- Career stage: {user_context.get('career_stage', 'Unknown')}
- Recent activity: {user_context.get('recent_activity', 'No recent activity')}
- Interaction mix: {user_context.get('behavior', {}).get('interaction_mix', {})}
- Top tags from engagement: {user_context.get('behavior', {}).get('top_tags', [])}
- Posting topics: {user_context.get('behavior', {}).get('posting_topics', [])}

Response style constraints:
- Keep answer medium length: around 90-150 words.
- Use short actionable bullets where useful (max 5 bullets).
- Avoid long essays and avoid repeating generic advice.
- Always personalize using available profile + behavior + memory context.
"""

    # Get recent conversation history (best-effort; AI should keep working even if table is unavailable)
    conversation_context = ""
    try:
        recent_conversations = db.query(AIConversation).filter(
            AIConversation.user_id == current_user.id
        ).order_by(AIConversation.created_at.desc()).limit(12).all()

        for conv in reversed(recent_conversations):
            conversation_context += f"User: {conv.message}\nAssistant: {conv.response}\n\n"
    except SQLAlchemyError as e:
        logger.warning("AI conversation history unavailable: %s", e)
    
    # Build semantic retrieval context (RAG) from Qdrant-indexed posts
    rag_context = _build_rag_context(message.message)

    # Build full prompt with context
    full_prompt = f"""{system_prompt}

Previous conversation:
{conversation_context if conversation_context else "No previous conversation"}

Long-term memory snapshot from user's platform activity:
{memory_snapshot}

Relevant platform content (semantic retrieval):
{rag_context if rag_context else "No relevant platform content found."}

Current message: {message.message}

Return:
- Personalized guidance
- Suggested connections direction
- Suggested project/learning direction
- Medium-length response only."""

    try:
        ai_response_text = await AIService.generate_ai_response(
            prompt=full_prompt,
            mode="free",
            temperature=0.6,
            max_tokens=280
        )

        # Detect intent from message
        intent = _detect_intent(message.message)

    except Exception as e:
        logger.exception("AI chat generation failed: %s", e)

        # Fallback graceful response
        ai_response_text = (
            "I am unable to fetch a full AI response right now. "
            "Please try again in a moment. "
            "I still added personalized recommendations below from your activity."
        )
        intent = "general_inquiry"
    
    # Save conversation (best-effort; do not fail chat response if persistence fails)
    try:
        new_conversation = AIConversation(
            user_id=current_user.id,
            message=message.message,
            response=ai_response_text,
            intent=intent
        )
        db.add(new_conversation)
        db.commit()
    except SQLAlchemyError as e:
        db.rollback()
        logger.warning("Failed to persist AI conversation: %s", e)
    
    # Generate recommendations based on intent + always-on personalization
    recommendations = None
    rec_content = None
    rec_users = None
    rec_opportunities = None

    async def _safe_with_timeout(coro, timeout_seconds: float, fallback_value):
        try:
            return await asyncio.wait_for(coro, timeout=timeout_seconds)
        except Exception:
            return fallback_value

    try:
        if intent == "learning_recommendation":
            courses = await _safe_with_timeout(
                recommendation_service.recommend_courses(db, current_user.id),
                timeout_seconds=6.0,
                fallback_value=[],
            )
            recommendations = courses[:4] if courses else None

        rec_content = await _safe_with_timeout(
            recommendation_service.recommend_content_for_user(
                db,
                current_user.id,
                limit=4 if intent != "general_inquiry" else 6,
            ),
            timeout_seconds=6.0,
            fallback_value=None,
        )
        rec_users = await _safe_with_timeout(
            recommendation_service.recommend_users_to_follow(
                db,
                current_user.id,
                limit=4 if intent != "career_advice" else 6,
            ),
            timeout_seconds=6.0,
            fallback_value=None,
        )
        rec_opportunities = await _safe_with_timeout(
            recommendation_service.recommend_opportunities(
                db,
                current_user.id,
                limit=4 if intent != "project_recommendation" else 6,
            ),
            timeout_seconds=6.0,
            fallback_value=None,
        )
    except Exception as e:
        logger.exception("AI recommendation generation failed: %s", e)
    
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


@router.get("/recommendations/projects", response_model=List[Dict])
async def get_project_recommendations(
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get personalized project recommendations."""

    recommendations = await recommendation_service.recommend_projects_for_user(
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
    
    try:
        conversations = db.query(AIConversation).filter(
            AIConversation.user_id == current_user.id
        ).order_by(AIConversation.created_at.desc()).limit(limit).all()
    except SQLAlchemyError as e:
        logger.warning("AI conversation history endpoint unavailable: %s", e)
        return []
    
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

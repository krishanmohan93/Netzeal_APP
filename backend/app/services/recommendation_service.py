"""
Recommendation engine combining AI and user behavior
"""
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from ..models import User, Post, UserInteraction, Follow, InteractionType
from .groq_deepseek_service import AIService
import json
from datetime import datetime, timedelta
from collections import Counter


class RecommendationService:
    """Service for generating personalized recommendations"""
    
    async def recommend_content_for_user(
        self,
        db: Session,
        user_id: int,
        limit: int = 10
    ) -> List[Dict]:
        """
        Generate personalized content recommendations based on user behavior
        
        Args:
            db: Database session
            user_id: User ID
            limit: Number of recommendations
            
        Returns:
            List of recommended posts
        """
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return []
        
        # Get user's interests and skills
        user_tags = set((user.skills or []) + (user.interests or []))
        
        # Get posts user has already interacted with
        interacted_post_ids = [
            interaction.post_id
            for interaction in db.query(UserInteraction).filter(
                UserInteraction.user_id == user_id
            ).all()
        ]
        
        # Find posts with matching tags
        query = db.query(Post).filter(Post.user_id != user_id)
        if interacted_post_ids:
            query = query.filter(~Post.id.in_(interacted_post_ids))
        
        # Score posts by relevance
        posts = query.order_by(desc(Post.created_at)).limit(limit * 3).all()
        
        scored_posts = []
        for post in posts:
            score = 0
            post_tags = set(post.tags or [])
            post_topics = set(post.topics or [])
            
            # Tag matching
            score += len(user_tags & post_tags) * 10
            score += len(user_tags & post_topics) * 5
            
            # Engagement boost
            score += (post.likes_count or 0) * 2
            score += (post.comments_count or 0) * 3
            
            # Recency boost (posts from last 7 days)
            days_old = (datetime.utcnow() - post.created_at).days
            if days_old < 7:
                score += (7 - days_old) * 2
            
            scored_posts.append((score, post))
        
        # Sort by score and return top N
        scored_posts.sort(key=lambda x: x[0], reverse=True)
        top_posts = [post for score, post in scored_posts[:limit]]
        
        if top_posts:
            return [self._post_to_dict(post) for post in top_posts]
        
        # Fallback: trending content
        return await self.get_trending_content(db, limit)
    
    async def recommend_users_to_follow(
        self,
        db: Session,
        user_id: int,
        limit: int = 10
    ) -> List[Dict]:
        """
        Recommend users to follow based on shared interests and activity
        
        Args:
            db: Database session
            user_id: User ID
            limit: Number of recommendations
            
        Returns:
            List of recommended users
        """
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return []
        
        # Get user's interests and skills
        user_tags = set((user.skills or []) + (user.interests or []))
        
        # Get already following
        following_ids = [user_id] + [
            follow.following_id
            for follow in db.query(Follow).filter(Follow.follower_id == user_id).all()
        ]
        
        # Find users with matching interests/skills
        candidates = db.query(User).filter(
            User.id.notin_(following_ids)
        ).limit(limit * 3).all()
        
        scored_users = []
        for candidate in candidates:
            score = 0
            candidate_tags = set((candidate.skills or []) + (candidate.interests or []))
            
            # Tag matching
            score += len(user_tags & candidate_tags) * 10
            
            # Activity boost (users who post regularly)
            post_count = db.query(func.count(Post.id)).filter(
                Post.user_id == candidate.id
            ).scalar()
            score += min(post_count or 0, 20)
            
            # Follower count boost (popular users)
            follower_count = db.query(func.count(Follow.id)).filter(
                Follow.following_id == candidate.id
            ).scalar()
            score += min(follower_count or 0, 15) * 0.5
            
            scored_users.append((score, candidate))
        
        # Sort by score and return top N
        scored_users.sort(key=lambda x: x[0], reverse=True)
        top_users = [user for score, user in scored_users[:limit]]
        
        return [self._user_to_dict(u) for u in top_users]
    
    async def recommend_courses(
        self,
        db: Session,
        user_id: int
    ) -> List[Dict]:
        """
        Recommend courses based on user profile using Groq AI
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            List of course recommendations
        """
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return []
        
        skills = user.skills or []
        interests = user.interests or []
        
        # Use Groq to generate course recommendations
        prompt = f"""Based on this developer profile, suggest 5 relevant online courses:
Skills: {', '.join(skills)}
Interests: {', '.join(interests)}
Bio: {user.bio or 'Not specified'}

For each course, provide:
1. Course title
2. Brief description (1 sentence)
3. Platform (Udemy, Coursera, etc.)
4. Skill level (Beginner/Intermediate/Advanced)

Format as a simple numbered list."""

        try:
            response = await AIService.generate_ai_response(
                prompt=prompt,
                mode="free",
                temperature=0.7,
                max_tokens=400
            )
            
            # Parse response into structured format
            courses = []
            lines = response.strip().split('\n')
            current_course = {}
            
            for line in lines:
                line = line.strip()
                if line and line[0].isdigit():
                    if current_course:
                        courses.append(current_course)
                    current_course = {"title": line.split('.', 1)[-1].strip()}
                elif ':' in line and current_course:
                    key, value = line.split(':', 1)
                    key = key.strip().lower()
                    if 'platform' in key:
                        current_course['platform'] = value.strip()
                    elif 'level' in key:
                        current_course['level'] = value.strip()
            
            if current_course:
                courses.append(current_course)
            
            return courses[:5]
            
        except Exception as e:
            print(f"Error generating course recommendations: {e}")
            return []
    
    async def get_trending_content(
        self,
        db: Session,
        limit: int = 10
    ) -> List[Dict]:
        """
        Get trending content based on engagement
        
        Args:
            db: Database session
            limit: Number of posts
            
        Returns:
            List of trending posts
        """
        # Calculate engagement score: likes + comments*2 + shares*3
        posts = db.query(Post).order_by(
            desc(Post.likes_count + Post.comments_count * 2 + Post.shares_count * 3)
        ).limit(limit).all()
        
        return [self._post_to_dict(post) for post in posts]
    
    async def get_user_analytics(
        self,
        db: Session,
        user_id: int
    ) -> Dict:
        """
        Generate user analytics and insights
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            Analytics dictionary
        """
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {}
        
        # Get user stats
        total_posts = db.query(func.count(Post.id)).filter(Post.author_id == user_id).scalar()
        total_likes = db.query(func.sum(Post.likes_count)).filter(Post.author_id == user_id).scalar() or 0
        total_comments = db.query(func.sum(Post.comments_count)).filter(Post.author_id == user_id).scalar() or 0
        total_views = db.query(func.sum(Post.views_count)).filter(Post.author_id == user_id).scalar() or 0
        
        # Calculate engagement rate
        engagement_rate = 0
        if total_views > 0:
            engagement_rate = ((total_likes + total_comments) / total_views) * 100
        
        # Get top topics from user's posts
        user_posts = db.query(Post).filter(Post.author_id == user_id).all()
        all_topics = []
        for post in user_posts:
            if post.topics:
                all_topics.extend(post.topics)
        
        # Count topic frequency
        topic_counts = Counter(all_topics)
        top_topics = [topic for topic, count in topic_counts.most_common(5)]
        
        return {
            "user_id": user_id,
            "total_posts": total_posts,
            "total_likes": total_likes,
            "total_comments": total_comments,
            "total_views": total_views,
            "engagement_rate": round(engagement_rate, 2),
            "top_topics": top_topics,
            "learning_progress": {},
            "skill_development": []
        }

    async def recommend_opportunities(
        self,
        db: Session,
        user_id: int,
        limit: int = 10
    ) -> List[Dict]:
        """
        Recommend opportunities (jobs, freelance, collab) derived from posts.
        Heuristics: posts with tags/topics mentioning hiring/job/freelance/opening/collab; 
        prioritize matches with user's interests/skills and recent recency/engagement.
        """
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return []

        interests = set((user.interests or []) + (user.skills or []))
        OPPORTUNITY_TAGS = {"hiring", "job", "jobs", "opening", "openings", "freelance", "contract", "collab", "collaboration", "help wanted", "looking for"}

        # fetch recent posts (last 90 days) and filter
        ninety_days_ago = datetime.utcnow() - timedelta(days=90)
        posts = db.query(Post).filter(Post.created_at >= ninety_days_ago).order_by(desc(Post.created_at)).all()

        scored = []
        for p in posts:
            tags = set([t.lower() for t in (p.tags or [])])
            text = f"{p.title or ''} {p.content or ''}".lower()
            is_opportunity = bool(tags & OPPORTUNITY_TAGS) or any(k in text for k in OPPORTUNITY_TAGS)
            if not is_opportunity:
                continue

            # score by engagement and interest overlap
            engagement = (p.likes_count or 0) + 2 * (p.comments_count or 0) + 3 * (p.shares_count or 0)
            topic_overlap = 0
            if p.topics:
                topic_overlap = len(set([t.lower() for t in p.topics]) & set([i.lower() for i in interests]))
            tag_overlap = len(tags & set([i.lower() for i in interests]))
            overlap_score = topic_overlap * 3 + tag_overlap * 2

            recency_boost = max(0, (p.created_at - ninety_days_ago).days) / 90.0
            score = engagement + overlap_score * 10 + recency_boost * 5

            scored.append((score, p))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [self._post_to_dict(p) for score, p in scored[:limit]]

    def summarize_user_behavior(self, db: Session, user_id: int) -> Dict:
        """
        Aggregate user interactions and posts into a compact behavioral profile for AI context.
        """
        interactions = db.query(UserInteraction).filter(UserInteraction.user_id == user_id).all()
        # top interaction types
        type_counts = Counter([i.interaction_type.value for i in interactions]) if interactions else Counter()

        # top posts' tags/topics user interacted with
        tag_counter = Counter()
        topic_counter = Counter()
        for inter in interactions:
            if inter.post and inter.post.tags:
                tag_counter.update([t.lower() for t in inter.post.tags])
            if inter.post and inter.post.topics:
                topic_counter.update([t.lower() for t in inter.post.topics])

        # user's own posting topics
        user_posts = db.query(Post).filter(Post.author_id == user_id).all()
        own_topics = Counter()
        for p in user_posts:
            if p.topics:
                own_topics.update([t.lower() for t in p.topics])

        return {
            "interaction_mix": dict(type_counts.most_common(5)),
            "top_tags": [t for t, _ in tag_counter.most_common(5)],
            "top_topics": [t for t, _ in topic_counter.most_common(5)],
            "posting_topics": [t for t, _ in own_topics.most_common(5)],
        }
    
    def _build_user_profile_text(self, user: User) -> str:
        """Build text representation of user profile for embedding"""
        parts = [user.bio or ""]
        
        if user.skills:
            parts.append(f"Skills: {', '.join(user.skills)}")
        
        if user.interests:
            parts.append(f"Interests: {', '.join(user.interests)}")
        
        if user.work_experience:
            for exp in user.work_experience:
                if isinstance(exp, dict):
                    parts.append(f"{exp.get('title', '')} at {exp.get('company', '')}")
        
        return " ".join(parts)
    
    def _post_to_dict(self, post: Post) -> Dict:
        """Convert post to dictionary"""
        return {
            "id": post.id,
            "title": post.title,
            "content": post.content[:200],  # Truncate
            "content_type": post.content_type.value if post.content_type else "post",
            "author_id": post.author_id,
            "likes_count": post.likes_count,
            "comments_count": post.comments_count,
            "created_at": post.created_at.isoformat() if post.created_at else None
        }
    
    def _user_to_dict(self, user: User) -> Dict:
        """Convert user to dictionary"""
        return {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "bio": user.bio,
            "profile_photo": user.profile_photo,
            "skills": user.skills,
            "interests": user.interests
        }


# Global instance
recommendation_service = RecommendationService()

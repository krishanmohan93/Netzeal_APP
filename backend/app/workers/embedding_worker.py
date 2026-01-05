from __future__ import annotations
from typing import Optional, List
from datetime import datetime, timedelta

from sqlalchemy.orm import Session
from ..core.database import SessionLocal
from ..models.content import Post, PostEmbedding, UserEmbedding
from ..services.embedding_service import EmbeddingService
from ..services.qdrant_service import QdrantService


class EmbeddingWorker:
    """Background worker to (re)embed posts and users.

    Usage:
        worker = EmbeddingWorker()
        worker.reembed_stale_posts()
    """

    def __init__(self, staleness_days: int = 30):
        self.staleness_days = staleness_days
        self.embed = EmbeddingService()
        self.qdrant = QdrantService()

    def _session(self) -> Session:
        return SessionLocal()

    def reembed_stale_posts(self, limit: int = 500):
        db = self._session()
        try:
            cutoff = datetime.utcnow() - timedelta(days=self.staleness_days)
            posts = db.query(Post).outerjoin(PostEmbedding, Post.id == PostEmbedding.post_id).filter(
                (PostEmbedding.updated_at == None) | (PostEmbedding.updated_at < cutoff)
            ).limit(limit).all()
            for p in posts:
                vectors = self.embed.embed_post(p.id, caption=p.content or "", hashtags=p.tags)
                payload = {
                    "likes_count": p.likes_count,
                    "comments_count": p.comments_count,
                    "created_at": p.created_at.isoformat() if p.created_at else None,
                    "category": p.category,
                }
                self.qdrant.upsert_post(p.id, p.author_id, vectors, payload)
        finally:
            db.close()

    def reembed_user(self, user_id: int, interests: Optional[List[str]] = None, profile_text: Optional[str] = None):
        self.embed.embed_user(user_id, interests, profile_text)


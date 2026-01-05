from __future__ import annotations
import os
from typing import Optional, List, Dict
import numpy as np
from sentence_transformers import SentenceTransformer

from ..core.database import SessionLocal
from ..models.content import PostEmbedding, UserEmbedding

DEFAULT_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")


class EmbeddingService:
    """Generates and caches embeddings for captions, hashtags, user interests, and queries.
    Stores cached embeddings in Postgres; other vector storage handled by QdrantService.
    """

    def __init__(self, model_name: str = DEFAULT_MODEL):
        self.model = SentenceTransformer(model_name)
        self.model_name = model_name

    def embed_text(self, text: str) -> List[float]:
        if not text:
            return []
        vec = self.model.encode(text, normalize_embeddings=True)
        return vec.astype(float).tolist() if isinstance(vec, np.ndarray) else list(vec)

    def embed_post(self, post_id: int, caption: str, hashtags: Optional[List[str]] = None, image_desc: Optional[str] = None) -> Dict[str, List[float]]:
        """Create or update embeddings for a post and return the vectors."""
        caption_vec = self.embed_text(caption)
        hashtags_vec = self.embed_text(" ".join(hashtags) if hashtags else "")
        image_vec = self.embed_text(image_desc) if image_desc else []

        db = SessionLocal()
        try:
            rec = db.query(PostEmbedding).filter(PostEmbedding.post_id == post_id).first()
            if rec is None:
                rec = PostEmbedding(post_id=post_id)
                db.add(rec)
            rec.caption_embedding = caption_vec
            rec.hashtags_embedding = hashtags_vec
            rec.image_embedding = image_vec
            rec.model_version = self.model_name
            db.commit()
        finally:
            db.close()

        return {
            "caption_embedding": caption_vec,
            "hashtags_embedding": hashtags_vec,
            "image_embedding": image_vec,
        }

    def embed_user(self, user_id: int, interests: Optional[List[str]] = None, profile_text: Optional[str] = None) -> Dict[str, List[float]]:
        interests_vec = self.embed_text(" ".join(interests) if interests else "")
        profile_vec = self.embed_text(profile_text or "")
        db = SessionLocal()
        try:
            rec = db.query(UserEmbedding).filter(UserEmbedding.user_id == user_id).first()
            if rec is None:
                rec = UserEmbedding(user_id=user_id)
                db.add(rec)
            rec.interests_embedding = interests_vec
            rec.profile_embedding = profile_vec
            rec.model_version = self.model_name
            db.commit()
        finally:
            db.close()
        return {"interests_embedding": interests_vec, "profile_embedding": profile_vec}

    def embed_query(self, query: str) -> List[float]:
        return self.embed_text(query)

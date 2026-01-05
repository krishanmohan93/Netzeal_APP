from __future__ import annotations
from typing import List, Dict, Optional
import os
from qdrant_client import QdrantClient
from qdrant_client.http import models as qm

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
POSTS_COLLECTION = os.getenv("QDRANT_COLLECTION_NAME", "netzeal_posts")
VECTOR_SIZE = int(os.getenv("VECTOR_SIZE", "384"))  # aligns with MiniLM-L6-v2


class QdrantService:
    def __init__(self):
        """Initialize Qdrant client. Uses in-memory mode if server is not available."""
        try:
            # Try to connect to Qdrant server
            self.client = QdrantClient(url=QDRANT_URL, timeout=2)
            self.client.get_collections()  # Test connection
            print(f"✅ Connected to Qdrant server at {QDRANT_URL}")
        except Exception as e:
            print(f"⚠️ Qdrant server not available, using in-memory mode: {e}")
            # Fallback to in-memory mode for development
            self.client = QdrantClient(":memory:")

    def init_posts_collection(self):
        """Initialize Qdrant collection with multiple named vectors (caption, hashtags, image)."""
        try:
            self.client.get_collection(POSTS_COLLECTION)
            return
        except Exception:
            pass
        self.client.create_collection(
            collection_name=POSTS_COLLECTION,
            vectors_config={
                "caption_embedding": qm.VectorParams(size=VECTOR_SIZE, distance=qm.Distance.COSINE),
                "hashtags_embedding": qm.VectorParams(size=VECTOR_SIZE, distance=qm.Distance.COSINE),
                "image_embedding": qm.VectorParams(size=VECTOR_SIZE, distance=qm.Distance.COSINE),
            },
            optimizers_config=qm.OptimizersConfigDiff(indexing_threshold=20000),
            replication_factor=1,
            write_consistency_factor=1
        )

    def upsert_post(self, post_id: int, user_id: int, vectors: Dict[str, List[float]], payload: Dict):
        """Upsert a post vector set into Qdrant.
        post_id used as point ID (int). Could switch to UUID externally.
        """
        payload = {**payload, "user_id": user_id, "post_id": post_id}
        self.client.upsert(
            collection_name=POSTS_COLLECTION,
            points=[qm.PointStruct(id=post_id, vector=vectors, payload=payload)]
        )

    def search_posts(self, query_vector: List[float], limit: int = 20, must_filters: Optional[Dict] = None):
        """Search against caption embeddings; apply optional payload filters."""
        fltrs = None
        if must_filters:
            conds = []
            for k, v in must_filters.items():
                conds.append(qm.FieldCondition(key=k, match=qm.MatchValue(value=v)))
            fltrs = qm.Filter(must=conds)
        result = self.client.search(
            collection_name=POSTS_COLLECTION,
            query_vector=("caption_embedding", query_vector),
            limit=limit,
            query_filter=fltrs
        )
        return result

    def similarity_batch(self, user_vec: List[float], candidate_ids: List[int]) -> Dict[int, float]:
        """Retrieve similarity scores for a batch of candidate IDs by pulling vectors and computing dot manually."""
        if not candidate_ids or not user_vec:
            return {}
        recs = self.client.retrieve(collection_name=POSTS_COLLECTION, ids=candidate_ids)
        scores = {}
        import numpy as np
        u = np.array(user_vec)
        for r in recs:
            v = np.array(r.vector.get("caption_embedding", []))
            if v.size == u.size and v.size > 0:
                # cosine similarity (vectors already normalized if we used model normalize)
                scores[r.id] = float(np.dot(u, v))
        return scores

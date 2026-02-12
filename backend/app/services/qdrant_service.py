from __future__ import annotations
from typing import List, Dict, Optional
import os
import logging
from qdrant_client import QdrantClient
from qdrant_client.http import models as qm

# Configure logging
logger = logging.getLogger(__name__)

# Load Qdrant Cloud configuration from environment variables
QDRANT_URL = os.getenv("QDRANT_URL")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
POSTS_COLLECTION = os.getenv("QDRANT_COLLECTION_NAME", "netzeal_posts")
VECTOR_SIZE = int(os.getenv("VECTOR_SIZE", "384"))  # aligns with MiniLM-L6-v2


class QdrantService:
    def __init__(self):
        """Initialize Qdrant Cloud client with secure HTTPS connection."""
        # Validate required environment variables
        if not QDRANT_URL:
            error_msg = "❌ QDRANT_URL environment variable is required for Qdrant Cloud connection"
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        if not QDRANT_API_KEY:
            error_msg = "❌ QDRANT_API_KEY environment variable is required for Qdrant Cloud connection"
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        try:
            # Connect to Qdrant Cloud with API key authentication
            self.client = QdrantClient(
                url=QDRANT_URL,
                api_key=QDRANT_API_KEY,
                timeout=10,  # Increased timeout for cloud connection
                prefer_grpc=False  # Use HTTP/HTTPS for better compatibility
            )
            
            # Verify connection by fetching collections
            self.client.get_collections()
            logger.info(f"✅ Successfully connected to Qdrant Cloud at {QDRANT_URL}")
            print(f"✅ Successfully connected to Qdrant Cloud at {QDRANT_URL}")
            
        except Exception as e:
            error_msg = f"❌ Failed to connect to Qdrant Cloud: {str(e)}"
            logger.error(error_msg)
            print(error_msg)
            raise ConnectionError(f"Qdrant Cloud connection failed. Please verify QDRANT_URL and QDRANT_API_KEY are correct. Error: {str(e)}")

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

"""Recommendation & Search API router.
Endpoints:
 - POST /embed/post
 - POST /qdrant/upsert
 - GET /recommend/feed
 - GET /recommend/explore
 - GET /search
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from datetime import datetime

from ..core.database import get_db
from ..core.security import get_current_user
from ..models.user import User
from ..models.content import Post, PostImpression
from ..services.embedding_service import EmbeddingService
from ..services.qdrant_service import QdrantService
from ..services.recommendation_service import RecommendationService
from ..utils.cache_service import cache_get, cache_set

router = APIRouter(prefix="/recommend", tags=["Recommendations"])


def get_services():
    return EmbeddingService(), QdrantService()


@router.post("/embed/post")
async def embed_post(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    post = db.query(Post).filter(Post.id == post_id, Post.author_id == current_user.id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found or not owned by user")
    embed_service, qdrant = get_services()
    vectors = embed_service.embed_post(post_id, caption=post.content or "", hashtags=post.tags, image_desc=None)
    payload = {
        "likes_count": post.likes_count,
        "comments_count": post.comments_count,
        "created_at": post.created_at.isoformat() if post.created_at else None,
        "category": post.category,
    }
    qdrant.upsert_post(post_id=post.id, user_id=post.author_id, vectors=vectors, payload=payload)
    return {"status": "ok", "post_id": post.id, "vectors_saved": list(vectors.keys())}


@router.post("/qdrant/upsert")
async def qdrant_upsert(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    embed_service, qdrant = get_services()
    vectors = embed_service.embed_post(post.id, caption=post.content or "", hashtags=post.tags)
    payload = {
        "likes_count": post.likes_count,
        "comments_count": post.comments_count,
        "created_at": post.created_at.isoformat() if post.created_at else None,
        "category": post.category,
    }
    qdrant.upsert_post(post_id=post.id, user_id=post.author_id, vectors=vectors, payload=payload)
    return {"status": "upserted", "post_id": post.id}


@router.get("/feed")
async def recommend_feed(
    cursor: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Return personalized ranked posts for a user with cursor pagination.
    Cursor format: score|post_id|timestamp_iso
    """
    # Use Redis cache to stabilize pagination within TTL window
    cache_key = f"rec:feed:{current_user.id}"
    cached = await cache_get(cache_key)
    item_dict = None
    if cached and isinstance(cached, dict) and "ids" in cached:
        ranked_ids = cached["ids"]
    else:
        embed_service, qdrant = get_services()
        rec_service = RecommendationService(db, embed_service, qdrant)
        ranked = rec_service.rank(current_user.id, limit=200)  # cache a larger window
        # Apply simple diversity: avoid long runs of same category
        def diversify(ranked_list):
            out = []
            run_cat = None
            run_len = 0
            buffer = ranked_list.copy()
            while buffer:
                r = buffer.pop(0)
                cat = (r.post.category or "uncat").lower()
                if cat == run_cat and run_len >= 3:
                    # find next different category
                    alt_idx = next((i for i, x in enumerate(buffer) if (x.post.category or "uncat").lower() != run_cat), None)
                    if alt_idx is not None:
                        r_alt = buffer.pop(alt_idx)
                        out.append(r_alt)
                        run_cat = (r_alt.post.category or "uncat").lower()
                        run_len = 1 if run_cat != cat else run_len + 1
                        # push r back to buffer for later consideration
                        buffer.insert(0, r)
                        continue
                out.append(r)
                if cat == run_cat:
                    run_len += 1
                else:
                    run_cat = cat
                    run_len = 1
            return out

        ranked = diversify(ranked)
        ranked_ids = [r.post.id for r in ranked]
        await cache_set(cache_key, {"ids": ranked_ids, "ts": datetime.utcnow().isoformat()}, ttl=60)

    # cursor is an index into ranked_ids
    start_idx = 0
    if cursor:
        try:
            start_idx = max(0, int(cursor))
        except Exception:
            start_idx = 0
    slice_ids = ranked_ids[start_idx:start_idx + limit]
    if not slice_ids:
        return {"items": [], "next_cursor": None}

    posts = db.query(Post).filter(Post.id.in_(slice_ids)).all()
    post_map = {p.id: p for p in posts}
    items = []
    for pid in slice_ids:
        p = post_map.get(pid)
        if not p:
            continue
        items.append({
            "id": p.id,
            "caption": p.content,
            "author_id": p.author_id,
            "likes": p.likes_count,
            "comments": p.comments_count,
            "created_at": p.created_at.isoformat() if p.created_at else None
        })
        imp = PostImpression(user_id=current_user.id, post_id=p.id)
        db.add(imp)
    db.commit()

    next_idx = start_idx + len(items)
    next_cursor = str(next_idx) if next_idx < len(ranked_ids) else None

    return {"items": items, "next_cursor": next_cursor}


@router.get("/explore")
async def recommend_explore(
    limit: int = Query(30, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Return trending posts (engagement last 24h) + cluster similarity placeholder."""
    # Trending = high likes/comments in last 24h
    from datetime import datetime, timedelta
    since = datetime.utcnow() - timedelta(hours=24)
    posts = db.query(Post).filter(Post.created_at >= since, Post.is_published == True).order_by(Post.likes_count.desc()).limit(limit).all()
    items = []
    for p in posts:
        items.append({
            "id": p.id,
            "caption": p.content,
            "author_id": p.author_id,
            "likes": p.likes_count,
            "comments": p.comments_count,
            "created_at": p.created_at.isoformat() if p.created_at else None
        })
    return {"items": items, "generated_at": datetime.utcnow().isoformat()}


@router.get("/search")
async def search(
    q: str = Query(..., min_length=2),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Hybrid semantic + keyword search.
    - Embed query
    - Query Qdrant caption vectors
    - Fallback to keyword LIKE in Postgres
    Merge and deduplicate by post id.
    """
    embed_service, qdrant = get_services()
    query_vec = embed_service.embed_query(q)
    q_hits = qdrant.search_posts(query_vec, limit=limit)
    semantic_ids = [int(p.id) for p in q_hits]

    kw_posts = db.query(Post).filter(Post.content.ilike(f"%{q}%")).limit(limit).all()
    merged = {}
    for hit in q_hits:
        merged[int(hit.id)] = {
            "id": int(hit.id),
            "score": hit.score,
            "semantic": True
        }
    for kp in kw_posts:
        entry = merged.get(kp.id, {"id": kp.id, "score": 0.0, "semantic": False})
        merged[kp.id] = entry

    posts = db.query(Post).filter(Post.id.in_(list(merged.keys()))).all()
    out = []
    for p in posts:
        meta = merged.get(p.id)
        out.append({
            "id": p.id,
            "caption": p.content,
            "author_id": p.author_id,
            "score": meta.get("score"),
            "semantic": meta.get("semantic"),
            "created_at": p.created_at.isoformat() if p.created_at else None
        })

    out.sort(key=lambda x: x["score"], reverse=True)
    return {"query": q, "results": out[:limit]}

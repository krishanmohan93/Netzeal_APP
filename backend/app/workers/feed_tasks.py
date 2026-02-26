"""
Background tasks for feed fanout.
"""
from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from ..celery_app import celery_app
from ..core.database import SessionLocal
from ..models.connection import Connection
from ..models.user import User
from ..utils.db_performance import bulk_insert_feed_items_safe
from ..utils.redis_cache import invalidate_all_feeds

logger = logging.getLogger(__name__)


def _get_fanout_user_ids(db: Session, author_id: int) -> list[int]:
    author = db.query(User).filter(User.id == author_id).first()
    if not author or not author.public_id:
        return []

    follower_rows = (
        db.query(Connection.follower_id)
        .filter(Connection.following_id == author.public_id, Connection.status == "connected")
        .all()
    )

    public_ids = {author.public_id}
    public_ids.update(row[0] for row in follower_rows if row[0])
    if not public_ids:
        return []

    return [row[0] for row in db.query(User.id).filter(User.public_id.in_(public_ids)).all()]


@celery_app.task(name="feed.fanout_post_to_followers", bind=True, max_retries=3, default_retry_delay=10)
def fanout_post_to_followers(self, post_id: int, author_id: int) -> None:
    """Fan out a post to follower feeds in the background."""
    db = SessionLocal()
    try:
        user_ids = _get_fanout_user_ids(db, author_id)
        if not user_ids:
            logger.info("No fanout recipients for post_id=%s author_id=%s", post_id, author_id)
            return

        inserted_count = bulk_insert_feed_items_safe(db, post_id, user_ids)
        logger.info("Fanout completed for post_id=%s recipients=%s inserted=%s", post_id, len(user_ids), inserted_count)

        try:
            import asyncio
            asyncio.run(invalidate_all_feeds(user_ids))
        except Exception as cache_err:
            logger.warning("Feed cache invalidation skipped for post_id=%s: %s", post_id, cache_err)

    except Exception as exc:
        logger.exception("Fanout task failed for post_id=%s author_id=%s", post_id, author_id)
        raise self.retry(exc=exc)
    finally:
        db.close()

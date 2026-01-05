"""
Performance utilities for database operations
"""
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import text


def bulk_insert_feed_items(db: Session, post_id: int, user_ids: List[int]) -> int:
    """
    Efficiently insert feed items using PostgreSQL COPY-like bulk insert.
    
    Args:
        db: SQLAlchemy session
        post_id: The post ID to fan out
        user_ids: List of user IDs to create feed items for
        
    Returns:
        Number of rows inserted
    """
    if not user_ids:
        return 0
    
    # Use VALUES clause for efficient bulk insert (much faster than bulk_save_objects)
    # This generates: INSERT INTO feed_items (user_id, post_id) VALUES (1, 42), (2, 42), ...
    values_list = [f"({user_id}, {post_id})" for user_id in user_ids]
    
    # Batch in chunks of 1000 to avoid hitting query size limits
    chunk_size = 1000
    total_inserted = 0
    
    for i in range(0, len(values_list), chunk_size):
        chunk = values_list[i:i + chunk_size]
        values_str = ", ".join(chunk)
        
        query = text(f"""
            INSERT INTO feed_items (user_id, post_id, created_at)
            VALUES {values_str}
            ON CONFLICT DO NOTHING
        """).bindparams()
        
        result = db.execute(query)
        total_inserted += result.rowcount
    
    db.commit()
    return total_inserted


def bulk_insert_feed_items_safe(db: Session, post_id: int, user_ids: List[int]) -> int:
    """
    Safely insert feed items with proper parameter binding (safer but slightly slower).
    
    Args:
        db: SQLAlchemy session
        post_id: The post ID to fan out
        user_ids: List of user IDs to create feed items for
        
    Returns:
        Number of rows inserted
    """
    if not user_ids:
        return 0
    
    # Use executemany with proper parameter binding
    # This is safer and still much faster than ORM bulk_save_objects
    chunk_size = 1000
    total_inserted = 0
    
    for i in range(0, len(user_ids), chunk_size):
        chunk = user_ids[i:i + chunk_size]
        
        # Prepare batch of values
        values = [{"user_id": uid, "post_id": post_id} for uid in chunk]
        
        query = text("""
            INSERT INTO feed_items (user_id, post_id)
            VALUES (:user_id, :post_id)
            ON CONFLICT DO NOTHING
        """)
        
        result = db.execute(query, values)
        total_inserted += result.rowcount
    
    db.commit()
    return total_inserted

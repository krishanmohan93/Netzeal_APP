"""
One-off migration script to align the live database with the latest SQLAlchemy models.

Fixes the following production errors seen in logs/screenshots:
- psycopg2.errors.UndefinedColumn: column posts.category does not exist
- 500s from feed/profile endpoints that depend on published_at / visibility

What this script does safely (idempotent):
- Adds missing columns to posts: thumbnail_url, duration_seconds, audio_track_url, location,
  category, is_published, visibility, published_at
- Ensures useful indexes exist
- Creates new tables if missing: feed_items, post_embeddings, user_embeddings, post_impressions
- Ensures the content_type enum contains all required values (article, video, infographic, post, reel, live)

Run it once from the backend venv: `python add_post_columns.py`
"""
import psycopg2
from psycopg2 import sql
from app.core.config import settings


def _exec(conn, cursor, statement, success_msg=None):
    try:
        cursor.execute(statement)
        conn.commit()
        if success_msg:
            print(success_msg)
        return True
    except psycopg2.errors.DuplicateColumn:
        conn.rollback()
        return False
    except psycopg2.errors.DuplicateTable:
        conn.rollback()
        return False
    except Exception as e:
        conn.rollback()
        print(f"   ❌ SQL error: {e}")
        return False


def add_missing_columns_and_tables():
    print("=" * 72)
    print("🔧 Migrating database to match models (safe/idempotent)")
    print("=" * 72)
    print(f"\n📡 Connecting to database: {settings.DATABASE_URL}")

    try:
        conn = psycopg2.connect(settings.DATABASE_URL)
        cursor = conn.cursor()
        print("✅ Connected successfully!\n")

        # 1) Ensure enum has all values (best-effort)
        enum_values = ["article", "video", "infographic", "post", "reel", "live"]
        for val in enum_values:
            _exec(
                conn,
                cursor,
                sql.SQL("ALTER TYPE content_type ADD VALUE IF NOT EXISTS %s;").as_string(cursor) % ("'" + val + "'"),
            )

        # 2) Add/ensure post columns
        print("🔨 Ensuring posts table columns exist…")
        add_column_statements = [
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;",
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;",
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS audio_track_url TEXT;",
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS location VARCHAR(255);",
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS category VARCHAR(64);",
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE;",
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS visibility VARCHAR(32) NOT NULL DEFAULT 'public';",
            "ALTER TABLE posts ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;",
        ]
        for stmt in add_column_statements:
            _exec(conn, cursor, stmt)

        # 3) Helpful indexes
        print("🔎 Ensuring indexes exist…")
        index_statements = [
            "CREATE INDEX IF NOT EXISTS ix_posts_published_visibility ON posts (is_published, visibility);",
            "CREATE INDEX IF NOT EXISTS ix_posts_published_at_desc ON posts (published_at DESC);",
            "CREATE INDEX IF NOT EXISTS ix_posts_category ON posts (category);",
        ]
        for stmt in index_statements:
            _exec(conn, cursor, stmt)

        # 4) Create auxiliary tables if missing (aligned with app/models/content.py)
        print("📦 Ensuring auxiliary tables exist…")
        tables_sql = [
            # feed_items
            """
            CREATE TABLE IF NOT EXISTS feed_items (
              id SERIAL PRIMARY KEY,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
              created_at TIMESTAMPTZ DEFAULT NOW()
            );
            """,
            "CREATE INDEX IF NOT EXISTS ix_feed_items_user_post ON feed_items (user_id, post_id);",
            "CREATE INDEX IF NOT EXISTS ix_feed_items_created_desc ON feed_items (created_at DESC);",

            # post_embeddings
            """
            CREATE TABLE IF NOT EXISTS post_embeddings (
              id SERIAL PRIMARY KEY,
              post_id INTEGER UNIQUE NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
              caption_embedding JSONB,
              hashtags_embedding JSONB,
              image_embedding JSONB,
              model_version VARCHAR(128),
              updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            """,

            # user_embeddings
            """
            CREATE TABLE IF NOT EXISTS user_embeddings (
              id SERIAL PRIMARY KEY,
              user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              interests_embedding JSONB,
              profile_embedding JSONB,
              model_version VARCHAR(128),
              updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            """,

            # post_impressions
            """
            CREATE TABLE IF NOT EXISTS post_impressions (
              id SERIAL PRIMARY KEY,
              user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
              post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
              created_at TIMESTAMPTZ DEFAULT NOW()
            );
            """,
            "CREATE INDEX IF NOT EXISTS ix_post_impressions_user_post ON post_impressions (user_id, post_id);",
        ]
        for stmt in tables_sql:
            _exec(conn, cursor, stmt)

        cursor.close()
        conn.close()
        print("\n✅ Migration completed. Database is aligned with models.")
        print("   If the app was running, restart the backend now.")
        return True

    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    ok = add_missing_columns_and_tables()
    print("\n🎉 Done" if ok else "\n⚠️  See error above")

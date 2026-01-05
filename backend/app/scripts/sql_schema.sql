-- Core tables (subset) aligned with SQLAlchemy models

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(150) UNIQUE NOT NULL,
  full_name VARCHAR(255),
  bio TEXT,
  profile_photo TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE content_type AS ENUM ('article','video','infographic','post','reel','live');

CREATE TABLE IF NOT EXISTS posts (
  id SERIAL PRIMARY KEY,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500),
  content TEXT NOT NULL,
  content_type content_type DEFAULT 'post',
  media_urls JSONB,
  thumbnail_url TEXT,
  duration_seconds INTEGER,
  audio_track_url TEXT,
  location VARCHAR(255),
  tags JSONB,
  views_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  embedding_vector JSONB,
  topics JSONB,
  category VARCHAR(64),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  is_published BOOLEAN DEFAULT FALSE NOT NULL,
  visibility VARCHAR(32) DEFAULT 'public' NOT NULL,
  published_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS ix_posts_published_visibility ON posts (is_published, visibility);
CREATE INDEX IF NOT EXISTS ix_posts_published_at_desc ON posts (published_at DESC);
CREATE INDEX IF NOT EXISTS ix_posts_category ON posts (category);

CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS likes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_likes_user_post ON likes (user_id, post_id);

CREATE TABLE IF NOT EXISTS follows (
  id SERIAL PRIMARY KEY,
  follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fan-out table
CREATE TABLE IF NOT EXISTS feed_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_feed_items_user_post ON feed_items (user_id, post_id);
CREATE INDEX IF NOT EXISTS ix_feed_items_created_desc ON feed_items (created_at DESC);

-- Embeddings cache
CREATE TABLE IF NOT EXISTS post_embeddings (
  id SERIAL PRIMARY KEY,
  post_id INTEGER UNIQUE NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  caption_embedding JSONB,
  hashtags_embedding JSONB,
  image_embedding JSONB,
  model_version VARCHAR(128),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_embeddings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interests_embedding JSONB,
  profile_embedding JSONB,
  model_version VARCHAR(128),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Impressions for seen-post penalty
CREATE TABLE IF NOT EXISTS post_impressions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ix_post_impressions_user_post ON post_impressions (user_id, post_id);

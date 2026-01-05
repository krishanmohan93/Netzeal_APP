"""
Database connection and session management
"""
import ssl
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from .config import settings

# Create synchronous database engine (for Alembic and sync operations)
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)

# Create async database engine (for async operations)
# Convert postgresql:// to postgresql+asyncpg://
# asyncpg doesn't support sslmode/channel_binding params - use ssl='require' instead
async_database_url = settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
# Remove unsupported params for asyncpg
if "sslmode=" in async_database_url or "channel_binding=" in async_database_url:
    # Split URL and query string
    if "?" in async_database_url:
        base_url, query_string = async_database_url.split("?", 1)
        # Filter out asyncpg-incompatible params
        params = query_string.split("&")
        filtered_params = [p for p in params if not p.startswith("sslmode=") and not p.startswith("channel_binding=")]
        async_database_url = base_url + ("?" + "&".join(filtered_params) if filtered_params else "")

# For Neon and similar SSL-required databases, asyncpg uses connect_args with ssl context
# Create SSL context for asyncpg
ssl_context = None
if "neon.tech" in async_database_url or "sslmode=require" in settings.DATABASE_URL:
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE  # For development; use CERT_REQUIRED in production

async_engine = create_async_engine(
    async_database_url, 
    pool_pre_ping=True, 
    echo=False,
    connect_args={"ssl": ssl_context} if ssl_context else {}
)

# Create session factory (sync)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

# Create base class for models
Base = declarative_base()


def get_db():
    """
    Database dependency for FastAPI routes (synchronous)
    Yields a database session and ensures it's closed after use
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


async def get_async_db():
    """
    Database dependency for async FastAPI routes
    Yields an async database session and ensures it's closed after use
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

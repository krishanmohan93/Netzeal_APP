"""
Database connection and session management
"""
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from .config import settings

def _normalize_sync_database_url(url: str) -> str:
    if url.startswith("postgres://"):
        return "postgresql://" + url[len("postgres://"):]
    return url


def _query_params(url: str) -> dict[str, str]:
    parsed = urlparse(url)
    return {k.lower(): v for k, v in parse_qsl(parsed.query, keep_blank_values=True)}


def _is_postgres_url(url: str) -> bool:
    return url.startswith("postgresql://") or url.startswith("postgresql+asyncpg://")


def _build_async_database_url(sync_url: str) -> str:
    if sync_url.startswith("sqlite://"):
        return sync_url.replace("sqlite://", "sqlite+aiosqlite://", 1)
    if sync_url.startswith("sqlite+aiosqlite://"):
        return sync_url

    if sync_url.startswith("postgresql+asyncpg://"):
        async_url = sync_url
    elif sync_url.startswith("postgresql://"):
        async_url = "postgresql+asyncpg://" + sync_url[len("postgresql://"):]
    else:
        async_url = sync_url

    parsed = urlparse(async_url)
    filtered_params = [
        (k, v)
        for (k, v) in parse_qsl(parsed.query, keep_blank_values=True)
        if k.lower() not in {"sslmode", "channel_binding"}
    ]
    return urlunparse(parsed._replace(query=urlencode(filtered_params)))


def _requires_ssl(sync_url: str) -> bool:
    params = _query_params(sync_url)
    sslmode = params.get("sslmode", "").lower()
    if sslmode in {"require", "verify-ca", "verify-full"}:
        return True

    host = (urlparse(sync_url).hostname or "").lower()
    return any(marker in host for marker in ("neon.tech", "supabase.co", "render.com", "railway.app"))


def _is_transaction_pooler(sync_url: str) -> bool:
    host = (urlparse(sync_url).hostname or "").lower()
    return "pooler" in host


sync_database_url = _normalize_sync_database_url(settings.DATABASE_URL)
async_database_url = _build_async_database_url(sync_database_url)
postgres_url = _is_postgres_url(sync_database_url)
transaction_pooler = _is_transaction_pooler(sync_database_url)
database_host = urlparse(sync_database_url).hostname or "unknown"

sync_connect_args = {}
if postgres_url and settings.DB_CONNECT_TIMEOUT_SECONDS > 0:
    sync_connect_args["connect_timeout"] = settings.DB_CONNECT_TIMEOUT_SECONDS

sync_engine_kwargs = {
    "pool_pre_ping": True,
    "pool_recycle": settings.DB_POOL_RECYCLE_SECONDS,
}

if postgres_url:
    sync_engine_kwargs.update(
        {
            "pool_size": settings.DB_POOL_SIZE,
            "max_overflow": settings.DB_MAX_OVERFLOW,
            "pool_timeout": settings.DB_POOL_TIMEOUT_SECONDS,
        }
    )

if sync_connect_args:
    sync_engine_kwargs["connect_args"] = sync_connect_args

# Create synchronous database engine (for Alembic and sync operations)
engine = create_engine(sync_database_url, **sync_engine_kwargs)

async_connect_args = {}
if postgres_url:
    if _requires_ssl(sync_database_url):
        # asyncpg expects ssl as parameter, not sslmode in query params.
        async_connect_args["ssl"] = "require"
    if settings.DB_CONNECT_TIMEOUT_SECONDS > 0:
        async_connect_args["timeout"] = settings.DB_CONNECT_TIMEOUT_SECONDS
    if settings.DB_COMMAND_TIMEOUT_SECONDS > 0:
        async_connect_args["command_timeout"] = settings.DB_COMMAND_TIMEOUT_SECONDS
    if transaction_pooler:
        # PgBouncer transaction pooling is safer with statement cache disabled.
        async_connect_args["statement_cache_size"] = 0

async_engine_kwargs = {
    "pool_pre_ping": True,
    "echo": False,
}

if postgres_url and not transaction_pooler:
    async_engine_kwargs.update(
        {
            "pool_size": settings.DB_POOL_SIZE,
            "max_overflow": settings.DB_MAX_OVERFLOW,
            "pool_timeout": settings.DB_POOL_TIMEOUT_SECONDS,
            "pool_recycle": settings.DB_POOL_RECYCLE_SECONDS,
        }
    )
else:
    # Prefer NullPool for SQLite and transaction-pooler URLs.
    async_engine_kwargs["poolclass"] = NullPool

if async_connect_args:
    async_engine_kwargs["connect_args"] = async_connect_args

async_engine = create_async_engine(async_database_url, **async_engine_kwargs)

print(
    "✅ Database config initialized "
    f"(host={database_host}, postgres={postgres_url}, "
    f"pooler={transaction_pooler}, ssl={'on' if _requires_ssl(sync_database_url) else 'off'})"
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

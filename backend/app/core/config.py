"""
Application configuration settings
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # Database
    DATABASE_URL: str
    
    # JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    EMAIL_VERIFICATION_TOKEN_EXPIRE_MINUTES: int = 1440
    PASSWORD_RESET_TOKEN_EXPIRE_MINUTES: int = 30
    
    # NVIDIA Integrate (OpenAI-compatible AI endpoint)
    NVIDIA_API_KEY: Optional[str] = None
    NVIDIA_API_BASE_URL: str = "https://integrate.api.nvidia.com/v1"
    NVIDIA_CHAT_MODEL: str = "deepseek-ai/deepseek-r1"

    # Legacy AI provider keys (optional, retained for backward compatibility)
    DEEPSEEK_API_KEY: Optional[str] = None
    GROQ_API_KEY: Optional[str] = None
    GROQ_API_BASE_URL: str = "https://api.groq.com/openai/v1"
    GROQ_CHAT_MODEL: str = "llama-3.1-8b-instant"
    OPENROUTER_API_KEY: Optional[str] = None
    AI_PRIMARY_PROVIDER: str = "groq"  # groq, nvidia, auto
    AI_MAX_RESPONSE_TOKENS: int = 320
    AI_REQUEST_TIMEOUT_SECONDS: int = 30
    
    # Qdrant Cloud (Vector Database for Semantic Search)
    QDRANT_URL: str  # Required: Qdrant Cloud cluster URL (e.g., https://xxx.qdrant.io)
    QDRANT_API_KEY: str  # Required: Qdrant Cloud API key
    QDRANT_COLLECTION_NAME: str = "netzeal_posts"
    VECTOR_SIZE: int = 384  # MiniLM-L6-v2 embedding size
    
    # Cloudinary (Media Storage)
    CLOUDINARY_CLOUD_NAME: str
    CLOUDINARY_API_KEY: str
    CLOUDINARY_API_SECRET: str

    # Google OAuth
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_ANDROID_CLIENT_ID: Optional[str] = None
    GOOGLE_IOS_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    
    # Application
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "NetZeal"
    DEBUG: bool = False
    REQUEST_TIMEOUT_SECONDS: int = 30
    MAX_REQUEST_SIZE_BYTES: int = 50 * 1024 * 1024
    MAX_MEDIA_UPLOAD_SIZE_BYTES: int = 80 * 1024 * 1024
    MAX_VIDEO_UPLOAD_SIZE_BYTES: int = 80 * 1024 * 1024
    GZIP_ENABLED: bool = True
    GZIP_MINIMUM_SIZE_BYTES: int = 1024
    FEED_CACHE_TTL_SECONDS: int = 30
    PROFILE_CACHE_TTL_SECONDS: int = 45
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT_SECONDS: int = 30
    DB_POOL_RECYCLE_SECONDS: int = 1800
    REDIS_URL: Optional[str] = None
    CELERY_BROKER_URL: Optional[str] = None
    CELERY_RESULT_BACKEND: Optional[str] = None
    CELERY_TASK_ALWAYS_EAGER: bool = False
    RATE_LIMIT_KEY_PREFIX: str = "rl"
    AUTH_RATE_LIMIT_PER_MINUTE: int = 10
    POST_CREATE_RATE_LIMIT_PER_MINUTE: int = 20
    ENGAGEMENT_RATE_LIMIT_PER_MINUTE: int = 60
    CHAT_RATE_LIMIT_PER_MINUTE: int = 45
    LIVE_STREAMING_ENABLED: bool = False
    SEMANTIC_FEATURES_ENABLED: bool = True
    EXPERIMENTAL_AI_ENABLED: bool = False
    
    # Security
    CORS_ORIGINS: Optional[str] = None  # Comma-separated list for production
    ALLOWED_HOSTS: Optional[str] = None  # Comma-separated list
    FORCE_HTTPS: bool = True
    SECURE_RESPONSE_HEADERS: bool = True
    HSTS_MAX_AGE: int = 31536000
    FIREBASE_SERVICE_ACCOUNT_KEY: Optional[str] = None
    FIREBASE_SERVICE_ACCOUNT_JSON: Optional[str] = None
    FRONTEND_BASE_URL: Optional[str] = "netzeal://auth"
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None
    SMTP_USE_TLS: bool = True
    BACKUP_DIR: str = "/tmp/netzeal_backups"
    BACKUP_RETENTION_DAYS: int = 7
    BACKUP_S3_BUCKET: Optional[str] = None

    @property
    def cors_origins_list(self) -> list[str]:
        if not self.CORS_ORIGINS:
            return [
                "netzeal://",
                "exp://",
                "https://auth.expo.io",
            ]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def allowed_hosts_list(self) -> list[str]:
        if not self.ALLOWED_HOSTS:
            return ["*"] if self.DEBUG else []
        return [host.strip() for host in self.ALLOWED_HOSTS.split(",") if host.strip()]
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

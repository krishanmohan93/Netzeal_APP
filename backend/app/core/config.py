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
    
    # DeepSeek (Primary AI)
    DEEPSEEK_API_KEY: str
    
    # Groq (Free AI - Fast responses)
    GROQ_API_KEY: str
    
    # OpenRouter (Alternative)
    OPENROUTER_API_KEY: str
    
    # Qdrant (Vector Database for Semantic Search)
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: Optional[str] = None
    QDRANT_COLLECTION_NAME: str = "netzeal_posts"
    VECTOR_SIZE: int = 384  # MiniLM-L6-v2 embedding size
    
    # Cloudinary (Media Storage)
    CLOUDINARY_CLOUD_NAME: str
    CLOUDINARY_API_KEY: str
    CLOUDINARY_API_SECRET: str
    
    # Application
    API_V1_PREFIX: str = "/api/v1"
    PROJECT_NAME: str = "NetZeal"
    DEBUG: bool = False
    
    # Security
    CORS_ORIGINS: Optional[str] = None  # Comma-separated list for production
    ALLOWED_HOSTS: Optional[str] = None  # Comma-separated list
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

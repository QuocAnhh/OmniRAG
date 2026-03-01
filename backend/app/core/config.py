from pydantic_settings import BaseSettings
from typing import List, Union
from pydantic import AnyHttpUrl, validator

class Settings(BaseSettings):
    PROJECT_NAME: str = "OmniRAG"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"  # development | staging | production
    
    # CORS
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://172.19.0.9:5173",  # Docker internal IP
        "http://frontend:5173",    # Docker service name
    ]

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # Database
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "password"
    POSTGRES_DB: str = "omnirag"
    SQLALCHEMY_DATABASE_URI: str | None = None

    @validator("SQLALCHEMY_DATABASE_URI", pre=True)
    def assemble_db_connection(cls, v: str | None, values: dict[str, any]) -> any:
        if isinstance(v, str):
            return v
        return f"postgresql://{values.get('POSTGRES_USER')}:{values.get('POSTGRES_PASSWORD')}@{values.get('POSTGRES_SERVER')}/{values.get('POSTGRES_DB')}"

    # JWT
    SECRET_KEY: str = "YOUR_SUPER_SECRET_KEY_CHANGE_ME"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    @validator("SECRET_KEY")
    def validate_secret_key(cls, v: str, values: dict) -> str:
        if v == "YOUR_SUPER_SECRET_KEY_CHANGE_ME" and values.get("ENVIRONMENT") == "production":
            raise ValueError("SECRET_KEY must be set in production")
        return v

    # ============================================================
    # AI Configuration - OpenRouter (Primary)
    # ============================================================
    # OpenRouter provides unified access to 400+ models
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_CHAT_MODEL: str = "openai/gpt-4o-mini"  # Default chat model
    OPENROUTER_EMBEDDING_MODEL: str = "openai/text-embedding-3-small"  # Default embedding model
    OPENROUTER_ENABLE_FALLBACKS: bool = True  # Enable automatic provider fallbacks
    OPENROUTER_SITE_URL: str = ""  # Optional: Your site URL for rankings
    OPENROUTER_SITE_NAME: str = "OmniRAG"  # Optional: Your site name for rankings
    
    # ============================================================
    # Legacy AI Providers (Optional - can be removed if not needed)
    # ============================================================
    # Kept for backward compatibility with existing services
    # Recommended: Migrate to OpenRouter for unified access
    AI_PROVIDER: str = "openrouter"  # Options: "openai", "megallm", "openrouter"
    OPENAI_API_KEY: str = ""  # Legacy - not needed if using OpenRouter
    MEGALLM_API_KEY: str = ""  # Legacy - not needed if using OpenRouter
    MEGALLM_BASE_URL: str = "https://ai.megallm.io/v1"
    
    # Legacy model configs (can be removed)
    DEFAULT_LLM_MODEL: str = "moonshotai/kimi-k2-instruct-0905"
    DEFAULT_LLM_FAST_MODEL: str = "gpt-3.5-turbo"
    DEFAULT_LLM_QUALITY_MODEL: str = "gpt-4"
    DEFAULT_EMBEDDING_MODEL: str = "text-embedding-ada-002"
    FALLBACK_LLM_MODELS: List[str] = ["claude-3.5-sonnet", "gpt-4", "gpt-3.5-turbo"]
    
    # Local embeddings (optional alternative to API)
    USE_LOCAL_EMBEDDINGS: bool = False  # Set to True to use local model instead of API
    LOCAL_EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    
    # Qdrant Vector DB
    QDRANT_HOST: str = "qdrant"
    QDRANT_PORT: int = 6333

    # MongoDB
    MONGODB_URL: str = "mongodb://admin:password@mongodb:27017"
    MONGODB_DB_NAME: str = "omnirag"

    # Redis
    REDIS_URL: str = "redis://redis:6379/0"

    # MinIO / S3
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "omnirag"
    MINIO_SECURE: bool = False

    # Celery
    CELERY_BROKER_URL: str = "redis://redis:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/0"

    # ============================================================
    # Public URL (for webhook registration)
    # ============================================================
    PUBLIC_URL: str = ""  # Public-facing URL of this backend (e.g. https://yourdomain.com)

    # ============================================================
    # Func.vn Hub Configuration (Zalo, etc.)
    # ============================================================
    FUNC_API_URL: str = ""  # The URL to call Func.vn API (Reply Zalo Message)
    FUNC_API_TOKEN: str = "" # The Token provided by Func.vn for authentication

    # ============================================================
    # Mem0 Memory Configuration
    # ============================================================
    MEM0_ENABLED: bool = True
    MEM0_COLLECTION_NAME: str = "omnirag_memories"
    MEM0_MEMORY_MODEL: str = "openai/gpt-4o-mini"     # LLM for fact extraction
    MEM0_TOP_K: int = 5                                # Memories retrieved per query

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()

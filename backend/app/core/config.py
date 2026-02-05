from pydantic_settings import BaseSettings
from typing import List, Union
from pydantic import AnyHttpUrl, validator

class Settings(BaseSettings):
    PROJECT_NAME: str = "OmniRAG"
    API_V1_STR: str = "/api/v1"
    
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

    # AI / Vector DB
    # AI Provider Configuration
    AI_PROVIDER: str = "megallm"  # Options: "openai", "megallm"
    
    # OpenAI API (kept for backward compatibility)
    OPENAI_API_KEY: str = ""
    
    # MegaLLM API (primary provider)
    MEGALLM_API_KEY: str = ""
    MEGALLM_BASE_URL: str = "https://ai.megallm.io/v1"
    
    # Default AI Models
    DEFAULT_LLM_MODEL: str = "moonshotai/kimi-k2-instruct-0905"
    DEFAULT_LLM_FAST_MODEL: str = "gpt-3.5-turbo"
    DEFAULT_LLM_QUALITY_MODEL: str = "gpt-4"
    DEFAULT_EMBEDDING_MODEL: str = "text-embedding-ada-002"
    
    # Fallback Models (used when primary fails)
    FALLBACK_LLM_MODELS: List[str] = [
        "claude-3.5-sonnet",
        "gpt-4",
        "gpt-3.5-turbo"
    ]
    
    # Local embeddings (free alternative to API embeddings)
    USE_LOCAL_EMBEDDINGS: bool = True
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

    class Config:
        case_sensitive = True
        env_file = ".env"

settings = Settings()

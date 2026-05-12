from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.core.config import settings

# Sync engine — used by Celery tasks and Alembic migrations
engine = create_engine(
    settings.SQLALCHEMY_DATABASE_URI,
    pool_size=5, max_overflow=10, pool_pre_ping=True, pool_recycle=1800,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Async engine — used by FastAPI endpoints via get_async_db()
ASYNC_DATABASE_URI = settings.SQLALCHEMY_DATABASE_URI.replace(
    "postgresql://", "postgresql+asyncpg://"
)
async_engine = create_async_engine(
    ASYNC_DATABASE_URI,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=1800,
)
AsyncSessionLocal = async_sessionmaker(bind=async_engine, expire_on_commit=False)

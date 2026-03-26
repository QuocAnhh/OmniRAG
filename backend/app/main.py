from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import asyncio
import logging
from app.core.config import settings
from app.db.mongodb import connect_to_mongodb, close_mongodb_connection
from app.db.redis import connect_to_redis, close_redis_connection

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def _preload_reranker():
    """Pre-load the reranker model in a background thread at startup."""
    try:
        from app.services.openrouter_rag_service import get_openrouter_rag_service
        svc = get_openrouter_rag_service()
        svc._get_reranker()
        logger.info("Reranker model pre-loaded successfully at startup")
    except Exception as e:
        logger.warning(f"Reranker pre-load failed (non-critical): {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_mongodb()
    await connect_to_redis()

    # Pre-load reranker model in background so first chat request is fast
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _preload_reranker)

    yield
    
    # Shutdown
    await close_mongodb_connection()
    await close_redis_connection()


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
    redirect_slashes=True  # Enable automatic trailing slash redirect
)

# CORS configuration - allow frontend origins from settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://localhost:8000"],
    allow_origin_regex="https?://(?:localhost|127\.0\.0\.1)(?::\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import api_router AFTER app is created to avoid circular import issues
from app.api.api import api_router

@app.get("/")
def root():
    return {"message": "Welcome to OmniRAG API"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)


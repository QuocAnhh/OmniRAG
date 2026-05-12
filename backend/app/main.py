from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager
from sqlalchemy import text
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.core.rate_limit import limiter
import asyncio
import httpx
import logging
import structlog
from app.core.config import settings
from app.core.middleware import RequestIDMiddleware
from app.core.metrics import metrics_response
from app.db.mongodb import connect_to_mongodb, close_mongodb_connection, mongodb
from app.db.redis import connect_to_redis, close_redis_connection, get_redis
from app.db.session import AsyncSessionLocal


def _setup_logging():
    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )
    logging.basicConfig(format="%(message)s", level=logging.INFO)


_setup_logging()
logger = structlog.get_logger()


def _preload_reranker():
    """Pre-load the reranker model in a background thread at startup."""
    try:
        from app.services.openrouter_rag_service import get_openrouter_rag_service
        svc = get_openrouter_rag_service()
        svc._get_reranker()
        logger.info("reranker_preloaded")
    except Exception as e:
        logger.warning("reranker_preload_failed", error=str(e))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_mongodb()
    await connect_to_redis()

    # Pre-load reranker model in background so first chat request is fast
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _preload_reranker)

    logger.info("startup_complete", environment=settings.ENVIRONMENT)

    yield

    # Shutdown
    await close_mongodb_connection()
    await close_redis_connection()

    # Close shared async OpenAI client
    try:
        from app.services.openrouter_service import get_openrouter_service
        svc = get_openrouter_service()
        await svc.close_async_client()
    except Exception as e:
        logger.warning("shutdown_cleanup_error", error=str(e))

    logger.info("shutdown_complete")


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
    redirect_slashes=True,
)

# ── Middleware (order matters: outermost first) ────────────────────────────────
app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(RequestIDMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(o) for o in settings.BACKEND_CORS_ORIGINS],
    allow_origin_regex=(
        r"https?://(?:localhost|127\.0\.0\.1)(?::\d+)?"
        + (r"|https://[a-z0-9-]+-\d+\.asse\.devtunnels\.ms" if settings.ENVIRONMENT != "production" else "")
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Rate Limiting ────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# ── Routes ────────────────────────────────────────────────────────────────────
from app.api.api import api_router


@app.get("/")
def root():
    return {"message": "Welcome to OmniRAG API"}


@app.get("/health")
async def health_check():
    """Health check with real dependency verification.
    Returns 200 if all deps are healthy, 503 if any are degraded."""
    checks = {}

    # PostgreSQL
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        checks["postgres"] = "healthy"
    except Exception:
        checks["postgres"] = "unhealthy"

    # Redis
    try:
        r = get_redis()
        if r:
            await r.ping()
            checks["redis"] = "healthy"
        else:
            checks["redis"] = "unhealthy"
    except Exception:
        checks["redis"] = "unhealthy"

    # MongoDB
    try:
        if mongodb.client:
            await mongodb.client.admin.command("ping")
            checks["mongodb"] = "healthy"
        else:
            checks["mongodb"] = "unhealthy"
    except Exception:
        checks["mongodb"] = "unhealthy"

    # Qdrant (REST health endpoint)
    try:
        qdrant_url = f"http://{settings.QDRANT_HOST}:{settings.QDRANT_PORT}/health"
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(qdrant_url)
        checks["qdrant"] = "healthy" if resp.status_code == 200 else "unhealthy"
    except Exception:
        checks["qdrant"] = "unhealthy"

    all_healthy = all(v == "healthy" for v in checks.values())
    status_code = 200 if all_healthy else 503
    return JSONResponse(
        content={"status": "healthy" if all_healthy else "degraded", "checks": checks},
        status_code=status_code,
    )


@app.get("/metrics")
def prometheus_metrics():
    return metrics_response()


app.include_router(api_router, prefix=settings.API_V1_STR)

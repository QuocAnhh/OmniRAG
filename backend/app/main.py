from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.core.config import settings
from app.db.mongodb import connect_to_mongodb, close_mongodb_connection
from app.db.redis import connect_to_redis, close_redis_connection
from app.db.base import Base
from app.db.session import engine


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_mongodb()
    await connect_to_redis()
    
    # Create database tables
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ Database tables created successfully")
    except Exception as e:
        print(f"⚠️  Error creating tables: {e}")
    
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

# CORS configuration - allow frontend origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for development in Docker
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

# Debug: Print all registered routes
print("🔍 Registered routes:")
for route in app.routes:
    if hasattr(route, 'path') and hasattr(route, 'methods'):
        print(f"  {route.methods} {route.path}")

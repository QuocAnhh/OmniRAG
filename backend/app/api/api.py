from fastapi import APIRouter
from app.api.v1.endpoints import bots, auth, tenants, data_grid, analytics, dashboard, users, integrations, openrouter

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(tenants.router, prefix="/tenants", tags=["tenants"])
api_router.include_router(bots.router, prefix="/bots", tags=["bots"])
api_router.include_router(data_grid.router, prefix="/data-grid", tags=["data-grid"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(integrations.router, prefix="/integrations", tags=["integrations"])
api_router.include_router(openrouter.router, prefix="/openrouter", tags=["openrouter"])

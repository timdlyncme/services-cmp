from fastapi import APIRouter

from app.api.endpoints import auth, tenants, permissions, nexus_ai

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(tenants.router, prefix="/tenants", tags=["tenants"])
api_router.include_router(permissions.router, prefix="/permissions", tags=["permissions"])
api_router.include_router(nexus_ai.router, prefix="/nexus-ai", tags=["nexus-ai"])

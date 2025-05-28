from fastapi import APIRouter

from app.api.endpoints import (
    auth, health, nexus_ai, permissions, tenants, 
    deployments, cloud_accounts, environments, 
    templates, integrations, users, template_foundry,
    service_accounts
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(nexus_ai.router, prefix="/nexus-ai", tags=["nexus-ai"])
api_router.include_router(permissions.router, prefix="/permissions", tags=["permissions"])
api_router.include_router(tenants.router, prefix="/tenants", tags=["tenants"])
api_router.include_router(deployments.router, prefix="/deployments", tags=["deployments"])
api_router.include_router(cloud_accounts.router, prefix="/cloud-accounts", tags=["cloud-accounts"])
api_router.include_router(environments.router, prefix="/environments", tags=["environments"])
api_router.include_router(templates.router, prefix="/templates", tags=["templates"])
api_router.include_router(integrations.router, prefix="/integrations", tags=["integrations"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(template_foundry.router, prefix="/template-foundry", tags=["template-foundry"])
api_router.include_router(service_accounts.router, prefix="/service-accounts", tags=["service-accounts"])

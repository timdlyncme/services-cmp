from fastapi import APIRouter

from app.api.endpoints import (
    auth, users, tenants, deployments, environments, 
    cloud_accounts, templates, permissions, integrations,
    template_foundry, health, ai_assistant, nexus_ai,
    dashboards, widget_data
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(tenants.router, prefix="/tenants", tags=["tenants"])
api_router.include_router(deployments.router, prefix="/deployments")
api_router.include_router(cloud_accounts.router, prefix="/cloud-accounts", tags=["cloud-accounts"])
api_router.include_router(environments.router, prefix="/environments", tags=["environments"])
api_router.include_router(templates.router, prefix="/templates", tags=["templates"])
api_router.include_router(permissions.router, prefix="/permissions", tags=["permissions"])
api_router.include_router(integrations.router, prefix="/integrations", tags=["integrations"])
api_router.include_router(template_foundry.router, prefix="/template-foundry", tags=["template-foundry"])
api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(ai_assistant.router, prefix="/ai-assistant", tags=["ai-assistant"])
api_router.include_router(nexus_ai.router, prefix="/nexus-ai", tags=["nexus-ai"])
api_router.include_router(dashboards.router, prefix="/dashboards", tags=["dashboards"])
api_router.include_router(widget_data.router, prefix="/widgets", tags=["widget-data"])

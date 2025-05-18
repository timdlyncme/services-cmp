from typing import Dict, Optional
from datetime import datetime
from pydantic import BaseModel


class IntegrationConfigBase(BaseModel):
    name: str
    type: str  # cloud, ai, other
    provider: str  # azure, aws, gcp, openai, other
    status: str  # connected, warning, error, pending
    settings: Dict[str, str] = {}


class IntegrationConfigCreate(IntegrationConfigBase):
    pass


class IntegrationConfigUpdate(IntegrationConfigBase):
    pass


class IntegrationConfigResponse(IntegrationConfigBase):
    id: int
    integration_id: str
    last_checked: datetime
    tenant_id: int

    class Config:
        from_attributes = True


class IntegrationConfigFrontendResponse(BaseModel):
    """Frontend-compatible integration config response"""
    id: str
    name: str
    type: str
    provider: str
    status: str
    lastChecked: str
    tenantId: str
    settings: Dict[str, str]

    class Config:
        from_attributes = False


from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel


class CloudAccountBase(BaseModel):
    name: str
    provider: str
    status: str
    description: Optional[str] = None


class CloudAccountCreate(CloudAccountBase):
    pass


class CloudAccountUpdate(CloudAccountBase):
    pass


class CloudAccountResponse(CloudAccountBase):
    id: int
    account_id: str
    tenant_id: int

    class Config:
        from_attributes = True


class EnvironmentBase(BaseModel):
    name: str
    description: Optional[str] = None


class EnvironmentCreate(EnvironmentBase):
    pass


class EnvironmentUpdate(EnvironmentBase):
    pass


class EnvironmentResponse(EnvironmentBase):
    id: int
    environment_id: str
    tenant_id: int

    class Config:
        from_attributes = True


class TemplateBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: str
    provider: str
    is_public: bool = False


class TemplateCreate(TemplateBase):
    pass


class TemplateUpdate(TemplateBase):
    pass


class TemplateResponse(TemplateBase):
    id: int
    template_id: str
    tenant_id: Optional[int] = None

    class Config:
        from_attributes = True


class DeploymentBase(BaseModel):
    name: str
    status: str


class DeploymentCreate(DeploymentBase):
    template_id: int
    environment_id: int
    cloud_account_id: int


class DeploymentUpdate(DeploymentBase):
    pass


class DeploymentResponse(DeploymentBase):
    id: int
    deployment_id: str
    created_at: datetime
    updated_at: datetime
    template_id: int
    environment_id: int
    cloud_account_id: int
    tenant_id: int
    created_by_id: int

    class Config:
        from_attributes = True


class CloudDeploymentResponse(BaseModel):
    """Frontend-compatible deployment response"""
    id: str
    name: str
    templateId: str
    templateName: str
    provider: str
    status: str
    environment: str
    createdAt: str
    updatedAt: str
    parameters: Dict[str, str] = {}
    resources: List[str] = []
    tenantId: str

    class Config:
        from_attributes = False


class CloudTemplateResponse(BaseModel):
    """Frontend-compatible template response"""
    id: str
    name: str
    description: str
    type: str
    provider: str
    code: str
    deploymentCount: int
    uploadedAt: str
    updatedAt: str
    categories: List[str]
    tenantId: str

    class Config:
        from_attributes = False


class CloudAccountFrontendResponse(BaseModel):
    """Frontend-compatible cloud account response"""
    id: str
    name: str
    provider: str
    status: str
    tenantId: str
    connectionDetails: Optional[Dict[str, str]] = None

    class Config:
        from_attributes = False


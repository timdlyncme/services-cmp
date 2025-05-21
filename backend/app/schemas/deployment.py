from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel


class CloudAccountBase(BaseModel):
    name: str
    provider: str
    description: Optional[str] = None
    status: Optional[str] = "connected"


class CloudAccountCreate(CloudAccountBase):
    pass


class CloudAccountUpdate(CloudAccountBase):
    name: Optional[str] = None
    provider: Optional[str] = None


class CloudAccountResponse(CloudAccountBase):
    id: int
    account_id: str
    tenant_id: int

    class Config:
        from_attributes = True


class EnvironmentBase(BaseModel):
    name: str
    description: Optional[str] = None
    update_strategy: Optional[str] = None
    scaling_policies: Optional[Dict[str, Any]] = None
    environment_variables: Optional[Dict[str, Any]] = None
    logging_config: Optional[Dict[str, Any]] = None
    monitoring_integration: Optional[Dict[str, Any]] = None
    cloud_account_ids: Optional[List[int]] = None


class EnvironmentCreate(EnvironmentBase):
    pass


class EnvironmentUpdate(EnvironmentBase):
    name: Optional[str] = None


class EnvironmentResponse(EnvironmentBase):
    id: int
    environment_id: str
    tenant_id: int
    cloud_accounts: Optional[List[CloudAccountResponse]] = None

    class Config:
        from_attributes = True


class TemplateBase(BaseModel):
    name: str
    description: Optional[str] = None
    category: Optional[str] = None
    provider: str
    is_public: Optional[bool] = False


class TemplateCreate(TemplateBase):
    code: str


class TemplateUpdate(TemplateBase):
    name: Optional[str] = None
    provider: Optional[str] = None
    code: Optional[str] = None


class TemplateVersionBase(BaseModel):
    version: str
    code: str
    commit_message: Optional[str] = None


class TemplateVersionCreate(TemplateVersionBase):
    pass


class TemplateVersionResponse(TemplateVersionBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class TemplateResponse(TemplateBase):
    id: int
    template_id: str
    tenant_id: int
    versions: Optional[List[TemplateVersionResponse]] = None

    class Config:
        from_attributes = True


class DeploymentBase(BaseModel):
    name: str
    description: Optional[str] = None
    environment_id: int
    template_id: int
    parameters: Optional[Dict[str, Any]] = None


class DeploymentCreate(DeploymentBase):
    pass


class DeploymentUpdate(DeploymentBase):
    name: Optional[str] = None
    environment_id: Optional[int] = None
    template_id: Optional[int] = None
    parameters: Optional[Dict[str, Any]] = None
    status: Optional[str] = None


class DeploymentHistoryBase(BaseModel):
    event_type: str
    event_details: Optional[Dict[str, Any]] = None


class DeploymentHistoryResponse(DeploymentHistoryBase):
    id: int
    timestamp: datetime
    user_id: int

    class Config:
        from_attributes = True


class DeploymentResponse(DeploymentBase):
    id: int
    deployment_id: str
    status: str
    created_at: datetime
    updated_at: datetime
    tenant_id: int
    environment: EnvironmentResponse
    template: TemplateResponse
    history: Optional[List[DeploymentHistoryResponse]] = None

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
    parameters: Dict[str, Any] = {}
    resources: List[str] = []
    tenantId: str
    region: Optional[str] = None

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

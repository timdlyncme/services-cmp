from typing import Optional, List, Dict, Any
from pydantic import BaseModel, validator
from datetime import datetime

# Base schemas
class DeploymentBase(BaseModel):
    name: str
    description: Optional[str] = None

class TemplateBase(BaseModel):
    name: str
    description: Optional[str] = None

class EnvironmentBase(BaseModel):
    name: str
    description: Optional[str] = None

# Cloud Account schemas
class CloudAccountBase(BaseModel):
    name: str
    provider: str
    status: str = "connected"
    description: Optional[str] = None
    settings_id: Optional[str] = None

class CloudAccountCreate(CloudAccountBase):
    connection_details: Optional[Dict[str, Any]] = None
    subscription_id: Optional[str] = None
    project_id: Optional[str] = None
    region: Optional[str] = None

class CloudAccountUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    connection_details: Optional[Dict[str, Any]] = None
    subscription_id: Optional[str] = None
    project_id: Optional[str] = None
    region: Optional[str] = None

class CloudAccountResponse(CloudAccountBase):
    id: str
    tenant_id: str
    created_at: str
    updated_at: str

    class Config:
        orm_mode = True

# Environment schemas
class EnvironmentCreate(EnvironmentBase):
    provider: str
    cloud_account_ids: Optional[List[str]] = None

class EnvironmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    provider: Optional[str] = None
    cloud_account_ids: Optional[List[str]] = None

class EnvironmentResponse(EnvironmentBase):
    id: str
    provider: str
    tenant_id: str
    created_at: str
    updated_at: str
    cloud_accounts: Optional[List[CloudAccountResponse]] = None

    class Config:
        orm_mode = True

# Template schemas
class TemplateCreate(TemplateBase):
    provider: str
    type: str
    category: Optional[str] = None
    is_public: bool = False
    code: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    variables: Optional[Dict[str, Any]] = None

class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    provider: Optional[str] = None
    type: Optional[str] = None
    category: Optional[str] = None
    is_public: Optional[bool] = None
    code: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    variables: Optional[Dict[str, Any]] = None

class TemplateResponse(TemplateBase):
    id: str
    provider: str
    type: str
    category: Optional[str] = None
    is_public: bool
    current_version: Optional[str] = None
    created_at: str
    updated_at: str
    tenant_id: str

    class Config:
        orm_mode = True

class TemplateDetailResponse(TemplateResponse):
    code: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    variables: Optional[Dict[str, Any]] = None

# Cloud Template Response (for frontend)
class CloudTemplateResponse(BaseModel):
    id: str
    template_id: str  # Include template_id explicitly
    name: str
    description: Optional[str] = None
    type: str
    provider: str
    code: str
    deploymentCount: int
    uploadedAt: str
    updatedAt: str
    categories: List[str]
    isPublic: bool
    currentVersion: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    variables: Optional[Dict[str, Any]] = None
    tenantId: str
    lastUpdatedBy: str

class TemplateVersionCreate(BaseModel):
    version: str
    code: str
    commit_message: Optional[str] = None

class TemplateVersionResponse(BaseModel):
    id: int
    version: str
    changes: Optional[str] = None
    created_at: str
    created_by: str
    is_current: bool

# Cloud Deployment Response schema
class CloudDeploymentResponse(BaseModel):
    id: str
    name: str
    templateId: str
    templateName: str
    status: str
    createdAt: str
    updatedAt: str
    tenantId: str
    environmentId: str
    environmentName: str
    createdBy: str
    parameters: Optional[Dict[str, Any]] = None
    resources: Optional[Dict[str, Any]] = None
    region: Optional[str] = None
    deploymentType: str

# Deployment schemas
class DeploymentCreate(DeploymentBase):
    environment_id: int
    template_id: str  # Changed from int to str to support GUID
    environment_name: str  # For deployment engine
    provider: str  # aws, azure, gcp
    deployment_type: str  # native, terraform
    template_source: str  # url, code
    template_url: Optional[str] = None
    template_code: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    project_id: Optional[str] = None  # For GCP

    @validator('template_source')
    def validate_template_source(cls, v, values):
        if v not in ['url', 'code']:
            raise ValueError('template_source must be either "url" or "code"')
        
        if v == 'url' and not values.get('template_url'):
            raise ValueError('template_url is required when template_source is "url"')
        
        # For code source, check if template_code exists and is not empty
        if v == 'code' and not values.get('template_code'):
            # If template_code is not provided, we'll get it from the template later
            pass
        
        return v

class DeploymentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    resources: Optional[Dict[str, Any]] = None
    region: Optional[str] = None
    cloud_deployment_id: Optional[str] = None

class DeploymentResponse(DeploymentBase):
    id: str
    status: str
    template_id: int
    environment_id: int
    tenant_id: str
    created_at: str
    updated_at: str
    parameters: Optional[Dict[str, Any]] = None
    resources: Optional[Dict[str, Any]] = None
    region: Optional[str] = None
    cloud_deployment_id: Optional[str] = None
    deployment_type: str

    class Config:
        orm_mode = True

# Deployment History schemas
class DeploymentHistoryCreate(BaseModel):
    deployment_id: int
    status: str
    details: Optional[str] = None

class DeploymentHistoryResponse(BaseModel):
    id: int
    deployment_id: int
    status: str
    details: Optional[str] = None
    created_at: str

    class Config:
        orm_mode = True


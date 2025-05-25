from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from pydantic import BaseModel, Field, validator
import uuid

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
    provider: str
    status: str = "connected"
    description: Optional[str] = None
    settings_id: Optional[str] = None
    cloud_ids: List[str] = []
    subscription_ids: List[str] = []  # For backward compatibility

class CloudAccountUpdate(CloudAccountBase):
    name: Optional[str] = None
    provider: Optional[str] = None
    status: Optional[str] = None
    description: Optional[str] = None
    settings_id: Optional[str] = None
    cloud_ids: Optional[List[str]] = None
    subscription_ids: Optional[List[str]] = None  # For backward compatibility

class CloudAccountResponse(CloudAccountBase):
    id: str
    tenant_id: str
    cloud_ids: List[str] = []
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True

class CloudAccountFrontendResponse(BaseModel):
    id: str
    name: str
    provider: str
    status: str
    tenantId: str
    cloud_ids: List[str] = []
    settings_id: Optional[str] = None
    connectionDetails: Dict[str, Any] = {}

    class Config:
        orm_mode = True
        from_attributes = True

# Template schemas
class TemplateCreate(TemplateBase):
    provider: str
    type: str
    code: Optional[str] = None
    is_public: bool = False
    category: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    variables: Optional[Dict[str, Any]] = None

class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    provider: Optional[str] = None
    type: Optional[str] = None
    code: Optional[str] = None
    is_public: Optional[bool] = None
    category: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    variables: Optional[Dict[str, Any]] = None

class TemplateResponse(TemplateBase):
    id: int
    template_id: str
    provider: str
    code: Optional[str] = None
    is_public: bool
    category: Optional[str] = None
    current_version: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    tenant_id: Optional[str] = None

    class Config:
        orm_mode = True
        from_attributes = True

class TemplateDetailResponse(TemplateResponse):
    code: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    variables: Optional[Dict[str, Any]] = None
    versions: List[Dict[str, Any]] = []

    class Config:
        orm_mode = True
        from_attributes = True

class CloudTemplateResponse(BaseModel):
    id: str
    name: str
    description: str
    type: str
    provider: str
    code: str
    deploymentCount: int
    uploadedAt: str
    updatedAt: str
    categories: List[str] = []
    tenantId: str
    lastUpdatedBy: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None

    class Config:
        orm_mode = True
        from_attributes = True

class TemplateVersionCreate(BaseModel):
    version: str
    code: str
    commit_message: Optional[str] = None

# Cloud Deployment Response schema
class CloudDeploymentResponse(BaseModel):
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
    resources: List[Dict[str, Any]] = []
    tenantId: str
    region: Optional[str] = None

    class Config:
        orm_mode = True
        from_attributes = True

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
        # Skip this validation as it's causing issues with valid requests
        # We'll handle this in the endpoint instead
        
        return v

    @validator('provider')
    def validate_provider(cls, v):
        if v not in ['aws', 'azure', 'gcp']:
            raise ValueError('provider must be one of: aws, azure, gcp')
        return v

    @validator('deployment_type')
    def validate_deployment_type(cls, v):
        if v not in ['native', 'terraform']:
            raise ValueError('deployment_type must be either "native" or "terraform"')
        return v
        
    @validator('environment_id')
    def validate_environment_id(cls, v):
        if v is None:
            raise ValueError('environment_id is required')
        return v

class DeploymentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    resources: Optional[List[Dict[str, Any]]] = None
    region: Optional[str] = None
    template_source: Optional[str] = None
    template_url: Optional[str] = None
    template_code: Optional[str] = None

    @validator('template_source')
    def validate_template_source(cls, v, values):
        if v and v not in ['url', 'code']:
            raise ValueError('template_source must be either "url" or "code"')
        
        if v == 'url' and not values.get('template_url'):
            raise ValueError('template_url is required when template_source is "url"')
        
        if v == 'code' and not values.get('template_code'):
            raise ValueError('template_code is required when template_source is "code"')
        
        return v

class DeploymentResponse(BaseModel):
    id: int
    deployment_id: str
    name: str
    status: str
    created_at: datetime
    updated_at: datetime
    cloud_deployment_id: Optional[str] = None

    class Config:
        orm_mode = True

class DeploymentHistoryItem(BaseModel):
    status: str
    message: Optional[str] = None
    created_at: datetime
    user: Optional[Dict[str, Any]] = None

    class Config:
        orm_mode = True

class DeploymentDetailResponse(DeploymentResponse):
    description: Optional[str] = None
    provider: str
    deployment_type: str
    template_source: str
    template_url: Optional[str] = None
    cloud_region: Optional[str] = None
    cloud_resources: Optional[List[Dict[str, Any]]] = None
    outputs: Optional[Dict[str, Any]] = None
    logs: Optional[str] = None
    error_details: Optional[Dict[str, Any]] = None
    completed_at: Optional[datetime] = None
    history: List[DeploymentHistoryItem] = []

    class Config:
        orm_mode = True

# Environment schemas
class EnvironmentCreate(EnvironmentBase):
    update_strategy: Optional[str] = None
    scaling_policies: Optional[Dict[str, Any]] = None
    environment_variables: Optional[Dict[str, Any]] = None
    logging_config: Optional[Dict[str, Any]] = None
    monitoring_integration: Optional[Dict[str, Any]] = None
    cloud_account_ids: List[Union[int, str]]  # Accept both int and string IDs

class EnvironmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    update_strategy: Optional[str] = None
    scaling_policies: Optional[Dict[str, Any]] = None
    environment_variables: Optional[Dict[str, Any]] = None
    logging_config: Optional[Dict[str, Any]] = None
    monitoring_integration: Optional[Dict[str, Any]] = None
    cloud_account_ids: Optional[List[Union[int, str]]] = None

class EnvironmentResponse(EnvironmentBase):
    id: str  # Changed from int to str to use environment_id
    internal_id: Optional[int] = None  # Added to store the internal ID if needed
    update_strategy: Optional[str] = None
    cloud_accounts: List[Dict[str, Any]] = []

    class Config:
        orm_mode = True

class EnvironmentDetailResponse(EnvironmentResponse):
    scaling_policies: Optional[Dict[str, Any]] = None
    environment_variables: Optional[Dict[str, Any]] = None
    logging_config: Optional[Dict[str, Any]] = None
    monitoring_integration: Optional[Dict[str, Any]] = None
    deployments: List[Dict[str, Any]] = []

    class Config:
        orm_mode = True

from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from pydantic import BaseModel, Field, validator
import uuid

# Base schemas
class DeploymentBase(BaseModel):
    name: str
    template_id: str
    environment: str
    cloud_account_id: str
    subscription_id: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    variables: Optional[Dict[str, Any]] = None
    
    class Config:
        from_attributes = True

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
        from_attributes = True
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
        from_attributes = True
        from_attributes = True

# Template schemas
class TemplateCreate(TemplateBase):
    provider: str
    type: str
    code: Optional[str] = None
    is_public: bool = False
    categories: Optional[List[str]] = []  # Changed from category to categories
    parameters: Optional[Dict[str, Any]] = None
    variables: Optional[Dict[str, Any]] = None

class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    provider: Optional[str] = None
    type: Optional[str] = None
    code: Optional[str] = None
    is_public: Optional[bool] = None
    categories: Optional[List[str]] = None  # Changed from category to categories
    parameters: Optional[Dict[str, Any]] = None
    variables: Optional[Dict[str, Any]] = None
    create_new_version: Optional[bool] = True  # Flag to control version creation

class TemplateResponse(TemplateBase):
    id: int
    template_id: str
    provider: str
    code: Optional[str] = None
    is_public: bool
    categories: Optional[List[str]] = []  # Changed from category to categories
    current_version: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    tenant_id: Optional[str] = None

    class Config:
        from_attributes = True
        from_attributes = True

class TemplateDetailResponse(TemplateResponse):
    code: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    variables: Optional[Dict[str, Any]] = None
    versions: List[Dict[str, Any]] = []

    class Config:
        from_attributes = True
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
    variables: Optional[Dict[str, Any]] = None
    currentVersion: Optional[str] = None
    template_id: Optional[str] = None
    isPublic: Optional[bool] = False

    class Config:
        from_attributes = True
        from_attributes = True

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
    templateVersion: Optional[str] = None  # Add template version
    provider: str
    status: str
    environment: str
    createdAt: str
    updatedAt: str
    parameters: Dict[str, Any] = {}
    resources: List[Dict[str, Any]] = []
    tenantId: str
    region: Optional[str] = None
    details: Optional[Dict[str, Any]] = None  # Add details field for outputs

    class Config:
        from_attributes = True
        from_attributes = True

# Deployment schemas
class DeploymentCreate(DeploymentBase):
    pass

class DeploymentUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    variables: Optional[Dict[str, Any]] = None
    
    class Config:
        from_attributes = True

class DeploymentResponse(BaseModel):
    id: int
    deployment_id: str
    name: str
    status: str
    created_at: datetime
    updated_at: datetime
    cloud_deployment_id: Optional[str] = None

    class Config:
        from_attributes = True

class DeploymentHistoryItem(BaseModel):
    status: str
    message: Optional[str] = None
    created_at: datetime
    user: Optional[Dict[str, Any]] = None

    class Config:
        from_attributes = True

class DeploymentDetailResponse(DeploymentResponse):
    description: Optional[str] = None
    provider: str
    deployment_type: str
    template_source: str
    template_url: Optional[str] = None
    cloud_properties: Optional[Dict[str, Any]] = None  # Cloud properties like location, resource_group, etc.
    cloud_resources: Optional[List[Dict[str, Any]]] = None
    outputs: Optional[Dict[str, Any]] = None
    logs: Optional[str] = None
    error_details: Optional[Dict[str, Any]] = None
    completed_at: Optional[datetime] = None
    history: List[DeploymentHistoryItem] = []

    class Config:
        from_attributes = True

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
        from_attributes = True

class EnvironmentDetailResponse(EnvironmentResponse):
    scaling_policies: Optional[Dict[str, Any]] = None
    environment_variables: Optional[Dict[str, Any]] = None
    logging_config: Optional[Dict[str, Any]] = None
    monitoring_integration: Optional[Dict[str, Any]] = None
    deployments: List[Dict[str, Any]] = []

    class Config:
        from_attributes = True

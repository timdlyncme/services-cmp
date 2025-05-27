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
    cloud_provider: str
    cloud_region: Optional[str] = None

# Cloud Account schemas
class CloudAccountBase(BaseModel):
    name: str
    description: Optional[str] = None
    cloud_provider: str
    credentials: Dict[str, Any]

class CloudAccountCreate(CloudAccountBase):
    tenant_id: Optional[str] = None

class CloudAccountUpdate(CloudAccountBase):
    name: Optional[str] = None
    description: Optional[str] = None
    cloud_provider: Optional[str] = None
    credentials: Optional[Dict[str, Any]] = None

class CloudAccountResponse(CloudAccountBase):
    id: str
    tenant_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True

class CloudAccountFrontendResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    cloud_provider: str
    tenant_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True

# Environment schemas
class EnvironmentCreate(EnvironmentBase):
    tenant_id: Optional[str] = None
    cloud_account_id: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    variables: Optional[Dict[str, Any]] = None

class EnvironmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    cloud_provider: Optional[str] = None
    cloud_region: Optional[str] = None
    cloud_account_id: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    variables: Optional[Dict[str, Any]] = None

class EnvironmentResponse(EnvironmentBase):
    id: str
    tenant_id: str
    cloud_account_id: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True

class EnvironmentDetailResponse(EnvironmentResponse):
    parameters: Optional[Dict[str, Any]] = None
    variables: Optional[Dict[str, Any]] = None

    class Config:
        orm_mode = True

# Template schemas
class TemplateCreate(TemplateBase):
    tenant_id: Optional[str] = None
    template_type: str
    template_content: str
    parameters_schema: Optional[Dict[str, Any]] = None
    variables_schema: Optional[Dict[str, Any]] = None

class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    template_type: Optional[str] = None
    template_content: Optional[str] = None
    parameters_schema: Optional[Dict[str, Any]] = None
    variables_schema: Optional[Dict[str, Any]] = None

class TemplateResponse(TemplateBase):
    id: str
    tenant_id: str
    template_type: str
    created_at: datetime
    updated_at: Optional[datetime] = None
    version: int
    latest_version: int

    class Config:
        orm_mode = True

class TemplateDetailResponse(TemplateResponse):
    template_content: str
    parameters_schema: Optional[Dict[str, Any]] = None
    variables_schema: Optional[Dict[str, Any]] = None

    class Config:
        orm_mode = True

class CloudTemplateResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    template_type: str
    cloud_provider: str
    cloud_region: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    version: int
    latest_version: int

    class Config:
        orm_mode = True

class TemplateVersionCreate(BaseModel):
    template_content: str
    parameters_schema: Optional[Dict[str, Any]] = None
    variables_schema: Optional[Dict[str, Any]] = None

class TemplateVersionResponse(BaseModel):
    id: str
    template_id: str
    version: int
    template_content: str
    parameters_schema: Optional[Dict[str, Any]] = None
    variables_schema: Optional[Dict[str, Any]] = None
    created_at: datetime

class CloudDeploymentResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    status: str
    deployment_type: str
    cloud_provider: str
    cloud_region: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    resources: List[Dict[str, Any]] = []

    class Config:
        orm_mode = True

# Deployment schemas
class DeploymentCreate(DeploymentBase):
    tenant_id: Optional[str] = None
    template_id: str
    environment_id: str
    deployment_type: str
    parameters: Optional[Dict[str, Any]] = None
    variables: Optional[Dict[str, Any]] = None
    template_version: Optional[int] = None
    provider: Optional[str] = None
    template_source: Optional[str] = None
    template_url: Optional[str] = None

    @validator('template_id', 'environment_id')
    def validate_uuid(cls, v):
        try:
            uuid.UUID(v)
            return v
        except ValueError:
            raise ValueError('Invalid UUID format')

class DeploymentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    parameters: Optional[Dict[str, Any]] = None
    variables: Optional[Dict[str, Any]] = None
    cloud_resources: Optional[List[Dict[str, Any]]] = None
    logs: Optional[Dict[str, Any]] = None
    outputs: Optional[Dict[str, Any]] = None
    error_details: Optional[Dict[str, Any]] = None
    completed_at: Optional[datetime] = None

class DeploymentResponse(BaseModel):
    id: str
    deployment_id: str
    name: str
    status: str
    tenant_id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        orm_mode = True

class DeploymentHistoryItem(BaseModel):
    id: str
    status: str
    message: Optional[str] = None
    created_at: datetime

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
    logs: Optional[Dict[str, Any]] = None
    error_details: Optional[Dict[str, Any]] = None
    completed_at: Optional[datetime] = None
    history: List[DeploymentHistoryItem] = []
    template: Optional[TemplateResponse] = None
    environment: Optional[EnvironmentResponse] = None
    parameters: Optional[Dict[str, Any]] = None
    variables: Optional[Dict[str, Any]] = None

    class Config:
        orm_mode = True

class DeploymentStatusUpdate(BaseModel):
    status: str
    message: Optional[str] = None
    logs: Optional[Dict[str, Any]] = None
    outputs: Optional[Dict[str, Any]] = None
    error_details: Optional[Dict[str, Any]] = None

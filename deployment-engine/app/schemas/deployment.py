from pydantic import BaseModel, Field, validator
from typing import Dict, Any, List, Optional, Union
from datetime import datetime
from enum import Enum

class DeploymentStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    DELETED = "deleted"

class CloudProvider(str, Enum):
    AWS = "aws"
    AZURE = "azure"
    GCP = "gcp"

class TemplateType(str, Enum):
    TERRAFORM = "terraform"
    ARM = "arm"
    CLOUDFORMATION = "cloudformation"

class DeploymentBase(BaseModel):
    name: str
    description: Optional[str] = None
    provider: CloudProvider
    cloud_account_id: str
    environment_id: str
    template_type: TemplateType
    is_dry_run: Optional[bool] = False
    auto_approve: Optional[bool] = False
    parameters: Optional[Dict[str, Any]] = None
    variables: Optional[Dict[str, Any]] = None

class DeploymentCreateWithTemplateId(DeploymentBase):
    template_id: str

class DeploymentCreateWithTemplateUrl(DeploymentBase):
    template_url: str

class DeploymentCreateWithTemplateCode(DeploymentBase):
    template_code: str

class DeploymentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    provider: CloudProvider
    cloud_account_id: str
    environment_id: str
    template_type: TemplateType
    template_id: Optional[str] = None
    template_url: Optional[str] = None
    template_code: Optional[str] = None
    is_dry_run: Optional[bool] = False
    auto_approve: Optional[bool] = False
    parameters: Optional[Dict[str, Any]] = None
    variables: Optional[Dict[str, Any]] = None
    
    @validator('template_id', 'template_url', 'template_code')
    def validate_template_source(cls, v, values, **kwargs):
        # Check that at least one template source is provided
        field = kwargs.get('field')
        if field.name == 'template_id':
            template_id = v
            template_url = values.get('template_url')
            template_code = values.get('template_code')
            
            if not any([template_id, template_url, template_code]):
                raise ValueError("At least one of template_id, template_url, or template_code must be provided")
        
        return v

class DeploymentUpdate(BaseModel):
    status: Optional[DeploymentStatus] = None
    outputs: Optional[Dict[str, Any]] = None
    resources: Optional[Dict[str, Any]] = None
    logs: Optional[str] = None
    error_message: Optional[str] = None
    error_details: Optional[Dict[str, Any]] = None
    completed_at: Optional[datetime] = None

class CloudAccountInfo(BaseModel):
    id: str
    name: str
    provider: CloudProvider

class EnvironmentInfo(BaseModel):
    id: str
    name: str

class DeploymentResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    status: DeploymentStatus
    provider: CloudProvider
    cloud_account: CloudAccountInfo
    environment: EnvironmentInfo
    template_type: TemplateType
    parameters: Optional[Dict[str, Any]] = None
    variables: Optional[Dict[str, Any]] = None
    outputs: Optional[Dict[str, Any]] = None
    resources: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    is_dry_run: bool
    auto_approve: bool
    error_message: Optional[str] = None
    
    class Config:
        orm_mode = True


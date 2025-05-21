from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import datetime


class TemplateFoundryBase(BaseModel):
    name: str
    description: Optional[str] = None
    type: str  # terraform, arm, cloudformation
    provider: str  # azure, aws, gcp
    code: str
    version: Optional[str] = "1.0.0"
    categories: Optional[List[str]] = None
    is_published: Optional[bool] = False
    author: Optional[str] = None
    commit_id: Optional[str] = None


class TemplateFoundryCreate(TemplateFoundryBase):
    tenant_id: Optional[str] = None


class TemplateFoundryUpdate(TemplateFoundryBase):
    pass


class TemplateFoundryResponse(TemplateFoundryBase):
    id: int
    template_id: str
    created_at: datetime
    updated_at: datetime
    tenant_id: int

    class Config:
        from_attributes = True


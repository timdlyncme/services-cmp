from typing import Optional, List, Dict, Any
from pydantic import BaseModel
from datetime import datetime


class TemplateFoundryBase(BaseModel):
    name: str
    description: Optional[str] = None
    type: str  # terraform, arm, cloudformation, etc.
    provider: str  # azure, aws, gcp, etc.
    code: str  # The actual template code
    version: str
    categories: Optional[List[str]] = []
    is_published: Optional[bool] = False
    author: Optional[str] = None
    commit_id: Optional[str] = None


class TemplateFoundryCreate(TemplateFoundryBase):
    pass


class TemplateFoundryUpdate(TemplateFoundryBase):
    name: Optional[str] = None
    type: Optional[str] = None
    provider: Optional[str] = None
    code: Optional[str] = None
    version: Optional[str] = None


class TemplateFoundryResponse(TemplateFoundryBase):
    id: int
    template_id: str
    tenant_id: int
    created_by_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


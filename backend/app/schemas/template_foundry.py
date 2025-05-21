from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel


class TemplateFoundryVersionBase(BaseModel):
    version: str
    changes: Optional[str] = None
    code: str


class TemplateFoundryVersionCreate(TemplateFoundryVersionBase):
    pass


class TemplateFoundryVersionResponse(TemplateFoundryVersionBase):
    id: int
    created_at: datetime
    created_by_id: Optional[int] = None
    
    class Config:
        from_attributes = True


class TemplateFoundryBase(BaseModel):
    name: str
    description: Optional[str] = None
    type: str  # terraform, arm, cloudformation, etc.
    provider: str  # azure, aws, gcp, etc.
    code: str
    version: str
    categories: Optional[List[str]] = None
    is_published: Optional[bool] = False
    author: Optional[str] = None
    commit_id: Optional[str] = None


class TemplateFoundryCreate(TemplateFoundryBase):
    pass


class TemplateFoundryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    type: Optional[str] = None
    provider: Optional[str] = None
    code: Optional[str] = None
    version: Optional[str] = None
    categories: Optional[List[str]] = None
    is_published: Optional[bool] = None
    author: Optional[str] = None
    commit_id: Optional[str] = None


class TemplateFoundryResponse(TemplateFoundryBase):
    id: int
    template_id: str
    tenant_id: str  # Changed to str for UUID
    created_by_id: int
    created_at: datetime
    updated_at: datetime
    versions: Optional[List[TemplateFoundryVersionResponse]] = None
    
    class Config:
        from_attributes = True

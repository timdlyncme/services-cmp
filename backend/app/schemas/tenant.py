from typing import Optional
from pydantic import BaseModel
from datetime import datetime


class TenantBase(BaseModel):
    name: str
    description: Optional[str] = None


class TenantCreate(TenantBase):
    pass


class TenantUpdate(TenantBase):
    pass


class TenantResponse(TenantBase):
    id: int
    tenant_id: str
    date_created: Optional[datetime] = None
    date_modified: Optional[datetime] = None

    class Config:
        from_attributes = True

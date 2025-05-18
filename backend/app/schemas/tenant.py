from typing import Optional
from pydantic import BaseModel


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

    class Config:
        from_attributes = True


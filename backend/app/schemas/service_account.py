from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
from uuid import UUID


class ServiceAccountBase(BaseModel):
    name: str
    description: Optional[str] = None
    username: str
    scope: Optional[str] = "system"
    tenant_id: Optional[UUID] = None
    role_id: Optional[int] = None


class ServiceAccountCreate(ServiceAccountBase):
    password: str


class ServiceAccountUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    password: Optional[str] = None
    scope: Optional[str] = None
    is_active: Optional[bool] = None
    tenant_id: Optional[UUID] = None
    role_id: Optional[int] = None


class ServiceAccountInDB(ServiceAccountBase):
    id: int
    service_account_id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True


class ServiceAccountResponse(ServiceAccountInDB):
    tenant_name: Optional[str] = None
    role_name: Optional[str] = None


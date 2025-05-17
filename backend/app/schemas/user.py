from typing import List, Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime


class PermissionBase(BaseModel):
    name: str
    description: Optional[str] = None


class Permission(PermissionBase):
    id: int

    class Config:
        orm_mode = True


class TenantBase(BaseModel):
    name: str
    description: Optional[str] = None


class TenantCreate(TenantBase):
    tenant_id: str


class Tenant(TenantBase):
    id: str
    tenant_id: str
    created_at: datetime

    class Config:
        orm_mode = True


class UserBase(BaseModel):
    name: str
    email: EmailStr


class UserCreate(UserBase):
    password: str
    role: str
    tenant_id: str


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role: Optional[str] = None
    tenant_id: Optional[str] = None


class User(UserBase):
    id: str
    role: str
    tenantId: str
    permissions: List[Permission] = []

    class Config:
        orm_mode = True


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None


class LoginResponse(BaseModel):
    user: User
    token: str


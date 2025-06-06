from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str


class UserBase(BaseModel):
    username: str
    full_name: Optional[str] = None
    email: EmailStr
    is_active: Optional[bool] = True


class User(BaseModel):
    id: str  # Changed to str for UUID
    name: str  # Changed from full_name for consistency
    email: EmailStr
    role: str
    tenantId: Optional[str] = None  # Current/primary tenant
    permissions: List[str] = []
    accessibleTenants: List[str] = []  # List of tenant IDs user can access
    isMspUser: bool = False


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: User  # Now User is defined above, no need for forward reference


class UserCreate(UserBase):
    password: str
    role: str
    tenant_id: Optional[str] = None
    additional_tenant_ids: Optional[List[str]] = []  # For multi-tenant assignments
    is_msp_user: Optional[bool] = False


class UserUpdate(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    role: Optional[str] = None
    tenant_id: Optional[str] = None
    additional_tenant_ids: Optional[List[str]] = None
    is_msp_user: Optional[bool] = None


class UserResponse(UserBase):
    id: str  # Changed from int to str to accept UUID
    user_id: str
    role: Optional[str] = None
    tenant_id: Optional[str] = None  # Changed to str for UUID
    is_msp_user: Optional[bool] = False
    
    class Config:
        from_attributes = True

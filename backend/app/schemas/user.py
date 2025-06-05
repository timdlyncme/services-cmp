from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str


class LoginResponse(BaseModel):
    user: Dict[str, Any]
    token: str
    token_type: str


class UserBase(BaseModel):
    username: str
    full_name: Optional[str] = None
    email: EmailStr
    is_active: Optional[bool] = True


class UserCreate(UserBase):
    password: str
    role: str
    tenant_id: Optional[str] = None
    individual_permissions: Optional[List[str]] = []  # List of permission names to grant individually


class UserUpdate(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    role: Optional[str] = None
    tenant_id: Optional[str] = None
    individual_permissions: Optional[List[str]] = None  # List of permission names to grant individually


class User(BaseModel):
    id: int
    user_id: str
    username: str
    full_name: Optional[str] = None
    email: EmailStr
    role: str
    tenantId: str
    permissions: List[str]
    individual_permissions: Optional[List[str]] = []  # Individual permissions beyond role
    is_sso_user: Optional[bool] = False
    sso_provider: Optional[str] = None


class UserSchema(User):
    """Alias for User schema for backward compatibility"""
    pass


class UserResponse(UserBase):
    id: int
    user_id: str
    role: Optional[str] = None
    tenant_id: Optional[str] = None  # Changed to str for UUID
    individual_permissions: Optional[List[str]] = []  # Individual permissions beyond role
    is_sso_user: Optional[bool] = False
    sso_provider: Optional[str] = None
    
    class Config:
        from_attributes = True


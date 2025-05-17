from typing import List, Optional

from pydantic import BaseModel, EmailStr


class Permission(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    
    class Config:
        from_attributes = True


class Role(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    
    class Config:
        from_attributes = True


class Tenant(BaseModel):
    id: int
    tenant_id: str
    name: str
    description: Optional[str] = None
    
    class Config:
        from_attributes = True


class User(BaseModel):
    id: Optional[str] = None
    name: str
    email: EmailStr
    role: str
    tenantId: str
    permissions: List[Permission] = []
    
    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role_id: int
    tenant_id: int


class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role_id: Optional[int] = None
    tenant_id: Optional[int] = None
    is_active: Optional[bool] = None


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: Optional[str] = None


class LoginResponse(BaseModel):
    user: User
    token: str


from typing import Optional, Dict, Any
from pydantic import BaseModel, EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: Optional[str] = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: Dict[str, Any]


class UserBase(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    is_active: Optional[bool] = True
    role: Optional[str] = None


class UserCreate(UserBase):
    email: EmailStr
    username: str
    password: str
    role: str


class UserUpdate(UserBase):
    password: Optional[str] = None


class UserResponse(UserBase):
    id: int
    email: EmailStr
    username: str
    tenant_id: int

    class Config:
        from_attributes = True


# Alias for backward compatibility
User = UserResponse

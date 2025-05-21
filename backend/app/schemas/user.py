from typing import Optional
from pydantic import BaseModel, EmailStr


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


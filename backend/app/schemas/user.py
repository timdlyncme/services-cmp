from typing import List, Optional

from pydantic import BaseModel, EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class User(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    tenantId: str
    permissions: List[str]


class LoginResponse(BaseModel):
    user: User
    token: str


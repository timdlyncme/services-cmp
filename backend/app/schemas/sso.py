from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr
from datetime import datetime


class SSOProviderBase(BaseModel):
    name: str
    provider_type: str
    is_active: Optional[bool] = True
    client_id: str
    tenant_id: Optional[str] = None
    authority: Optional[str] = None
    discovery_url: Optional[str] = None
    scim_enabled: Optional[bool] = False
    scim_base_url: Optional[str] = None
    attribute_mappings: Optional[Dict[str, str]] = None
    default_role_id: Optional[int] = None


class SSOProviderCreate(SSOProviderBase):
    client_secret: str
    scim_bearer_token: Optional[str] = None
    tenant_id_fk: str  # UUID of the tenant this provider belongs to


class SSOProviderUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    tenant_id: Optional[str] = None
    authority: Optional[str] = None
    discovery_url: Optional[str] = None
    scim_enabled: Optional[bool] = None
    scim_base_url: Optional[str] = None
    scim_bearer_token: Optional[str] = None
    attribute_mappings: Optional[Dict[str, str]] = None
    default_role_id: Optional[int] = None


class SSOProviderResponse(SSOProviderBase):
    id: int
    provider_id: str
    client_secret: str = "********"  # Always masked in responses
    scim_bearer_token: str = "********"  # Always masked in responses
    tenant_id_fk: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class SSOUserMappingBase(BaseModel):
    external_user_id: str
    external_email: EmailStr
    external_username: Optional[str] = None
    external_display_name: Optional[str] = None
    external_groups: Optional[List[str]] = None
    is_active: Optional[bool] = True
    sync_enabled: Optional[bool] = True


class SSOUserMappingCreate(SSOUserMappingBase):
    provider_id: int
    internal_user_id: int


class SSOUserMappingUpdate(BaseModel):
    external_username: Optional[str] = None
    external_display_name: Optional[str] = None
    external_groups: Optional[List[str]] = None
    is_active: Optional[bool] = None
    sync_enabled: Optional[bool] = None


class SSOUserMappingResponse(SSOUserMappingBase):
    id: int
    mapping_id: str
    provider_id: int
    internal_user_id: int
    provisioned_at: datetime
    last_login_at: Optional[datetime] = None
    last_sync_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class SSOLoginRequest(BaseModel):
    provider_type: str
    tenant_id: Optional[str] = None  # Optional - backend will use first available tenant if not provided
    domain: Optional[str] = None  # For domain-based provider selection
    redirect_uri: Optional[str] = None


class SSOLoginResponse(BaseModel):
    authorization_url: str
    state: str


class SSOCallbackRequest(BaseModel):
    code: str
    state: str
    provider_type: str
    redirect_uri: Optional[str] = None  # Include redirect URI for token exchange


class SSOCallbackResponse(BaseModel):
    user: Dict[str, Any]
    token: str
    token_type: str
    is_new_user: bool


class SCIMUserRequest(BaseModel):
    """SCIM User resource for provisioning"""
    schemas: List[str] = ["urn:ietf:params:scim:schemas:core:2.0:User"]
    userName: str
    name: Optional[Dict[str, str]] = None
    displayName: Optional[str] = None
    emails: List[Dict[str, Any]]
    active: Optional[bool] = True
    groups: Optional[List[Dict[str, str]]] = None
    externalId: Optional[str] = None


class SCIMUserResponse(BaseModel):
    """SCIM User resource response"""
    schemas: List[str] = ["urn:ietf:params:scim:schemas:core:2.0:User"]
    id: str
    userName: str
    name: Optional[Dict[str, str]] = None
    displayName: Optional[str] = None
    emails: List[Dict[str, Any]]
    active: bool
    groups: Optional[List[Dict[str, str]]] = None
    externalId: Optional[str] = None
    meta: Dict[str, Any]


class SCIMGroupRequest(BaseModel):
    """SCIM Group resource for provisioning"""
    schemas: List[str] = ["urn:ietf:params:scim:schemas:core:2.0:Group"]
    displayName: str
    members: Optional[List[Dict[str, str]]] = None
    externalId: Optional[str] = None


class SCIMGroupResponse(BaseModel):
    """SCIM Group resource response"""
    schemas: List[str] = ["urn:ietf:params:scim:schemas:core:2.0:Group"]
    id: str
    displayName: str
    members: Optional[List[Dict[str, str]]] = None
    externalId: Optional[str] = None
    meta: Dict[str, Any]


class SCIMListResponse(BaseModel):
    """SCIM List response wrapper"""
    schemas: List[str] = ["urn:ietf:params:scim:api:messages:2.0:ListResponse"]
    totalResults: int
    startIndex: int
    itemsPerPage: int
    Resources: List[Dict[str, Any]]


class SCIMErrorResponse(BaseModel):
    """SCIM Error response"""
    schemas: List[str] = ["urn:ietf:params:scim:api:messages:2.0:Error"]
    status: str
    detail: str

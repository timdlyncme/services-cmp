from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr, validator


class Token(BaseModel):
    access_token: str
    token_type: str


# SSO_FUTURE: Tenant assignment schema for multi-tenant user management
class TenantAssignmentCreate(BaseModel):
    """Schema for creating tenant assignments during user creation/update"""
    tenant_id: str
    role_id: int
    is_primary: bool = False
    is_active: bool = True  # Add missing is_active field
    
    # SSO_FUTURE: Fields for SSO-based assignments
    provisioned_via: Optional[str] = "manual"  # "manual", "sso", "api"
    external_group_id: Optional[str] = None  # Azure AD Group ID
    external_role_mapping: Optional[str] = None  # Azure AD role claim


class TenantAssignmentResponse(BaseModel):
    """Schema for returning tenant assignment information"""
    tenant_id: str
    tenant_name: Optional[str] = None
    role_id: int
    role_name: Optional[str] = None
    is_primary: bool
    is_active: bool
    
    # SSO_FUTURE: SSO provisioning information
    provisioned_via: str = "manual"
    external_group_id: Optional[str] = None
    external_role_mapping: Optional[str] = None
    
    class Config:
        from_attributes = True


class UserBase(BaseModel):
    username: str
    full_name: Optional[str] = None
    email: EmailStr
    is_active: Optional[bool] = True


class User(BaseModel):
    id: str  # Changed to str for UUID
    name: str  # Changed from full_name for consistency
    email: EmailStr
    role: Optional[str] = None  # Made optional since roles are now per-tenant
    tenantId: Optional[str] = None  # Current/primary tenant
    permissions: List[str] = []
    accessibleTenants: List[str] = []  # List of tenant IDs user can access
    isMspUser: bool = False
    
    # SSO_FUTURE: Additional fields for SSO user information
    isSSO: bool = False  # Whether user authenticates via SSO
    identityProvider: Optional[str] = "local"  # "local", "azure_ad", etc.


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: User  # Now User is defined above, no need for forward reference


class UserCreate(UserBase):
    password: Optional[str] = None  # SSO_FUTURE: Made optional for SSO users
    role: Optional[str] = None  # Made optional since roles are now per-tenant
    
    # Multi-tenant assignment support
    tenant_assignments: List[TenantAssignmentCreate] = []
    
    # Backward compatibility - single tenant assignment
    tenant_id: Optional[str] = None
    
    # SSO_FUTURE: External identity fields for SSO user creation
    external_id: Optional[str] = None  # Azure AD Object ID
    identity_provider: str = "local"  # "local", "azure_ad", etc.
    
    is_msp_user: Optional[bool] = False
    
    @validator('tenant_assignments', always=True)
    def validate_tenant_assignments(cls, v, values):
        """Ensure exactly one primary tenant assignment"""
        if not v:
            return v
        
        primary_count = sum(1 for assignment in v if assignment.is_primary)
        if primary_count == 0:
            # If no primary specified, make the first one primary
            if v:
                v[0].is_primary = True
        elif primary_count > 1:
            raise ValueError("Only one tenant assignment can be marked as primary")
        
        return v
    
    @validator('password')
    def validate_password_for_local_users(cls, v, values):
        """SSO_FUTURE: Validate password requirements based on identity provider"""
        identity_provider = values.get('identity_provider', 'local')
        
        if identity_provider == 'local' and not v:
            raise ValueError("Password is required for local users")
        
        # SSO_FUTURE: SSO users don't need passwords
        if identity_provider != 'local' and v:
            raise ValueError("Password should not be provided for SSO users")
        
        return v


class UserUpdate(BaseModel):
    username: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    role: Optional[str] = None
    
    # Multi-tenant assignment updates
    tenant_assignments: Optional[List[TenantAssignmentCreate]] = None
    
    # Backward compatibility
    tenant_id: Optional[str] = None
    
    is_msp_user: Optional[bool] = None
    
    @validator('tenant_assignments')
    def validate_tenant_assignments_update(cls, v):
        """Ensure at most one primary tenant assignment"""
        if not v:
            return v
        
        primary_count = sum(1 for assignment in v if assignment.is_primary)
        if primary_count > 1:
            raise ValueError("Only one tenant assignment can be marked as primary")
        
        return v


class UserResponse(UserBase):
    id: str  # Changed from int to str to accept UUID
    user_id: str
    role: Optional[str] = None
    
    # Multi-tenant information
    tenant_assignments: List[TenantAssignmentResponse] = []
    primary_tenant_id: Optional[str] = None
    
    # Backward compatibility
    tenant_id: Optional[str] = None  # Will be populated with primary tenant
    
    is_msp_user: Optional[bool] = False
    
    # SSO_FUTURE: SSO user information
    external_id: Optional[str] = None
    identity_provider: str = "local"
    is_sso_user: bool = False
    
    class Config:
        from_attributes = True

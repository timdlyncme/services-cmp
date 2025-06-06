from typing import Optional, List
from pydantic import BaseModel, validator


class PermissionBase(BaseModel):
    name: str
    description: Optional[str] = None


class PermissionCreate(PermissionBase):
    roles: List[str]  # List of role names to assign this permission to
    
    @validator('name')
    def validate_permission_name(cls, v):
        """Validate that permission name follows action:service format"""
        if not v or ':' not in v:
            raise ValueError('Permission name must follow the format "action:service" (e.g., "view:users", "create:tenants")')
        
        parts = v.split(':')
        if len(parts) != 2:
            raise ValueError('Permission name must contain exactly one colon separating action and service')
        
        action, service = parts
        if not action.strip() or not service.strip():
            raise ValueError('Both action and service parts must be non-empty')
        
        # Validate action format (lowercase, no special characters except hyphens)
        if not action.replace('-', '').replace('_', '').isalnum():
            raise ValueError('Action must contain only alphanumeric characters, hyphens, and underscores')
        
        # Validate service format (lowercase, no special characters except hyphens)
        if not service.replace('-', '').replace('_', '').isalnum():
            raise ValueError('Service must contain only alphanumeric characters, hyphens, and underscores')
        
        return v.lower()  # Ensure consistent lowercase format
    
    @validator('roles')
    def validate_roles(cls, v):
        """Validate that roles are valid and non-empty"""
        if not v:
            raise ValueError('At least one role must be specified')
        
        valid_roles = {'user', 'admin', 'msp'}
        invalid_roles = [role for role in v if role not in valid_roles]
        if invalid_roles:
            raise ValueError(f'Invalid roles: {invalid_roles}. Valid roles are: {valid_roles}')
        
        # Remove duplicates while preserving order
        return list(dict.fromkeys(v))


class PermissionUpdate(PermissionBase):
    pass


class PermissionResponse(PermissionBase):
    id: int

    class Config:
        from_attributes = True

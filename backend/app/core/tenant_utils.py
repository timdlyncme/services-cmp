"""
Tenant management utilities for multi-tenant user operations.

This module provides utilities for:
- Resolving user's current tenant context
- Validating tenant access permissions
- Managing tenant assignments
- Replacing legacy current_user.tenant_id usage

SSO_FUTURE: These utilities will be extended to handle:
- Domain-based tenant resolution for SSO login flows
- Automated tenant assignment via Azure AD group mappings
- SSO user provisioning and synchronization
"""

from typing import Optional, List
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.user import User, Tenant
from app.models.user_tenant_assignment import UserTenantAssignment
from app.core.permissions import has_permission_in_tenant


def get_user_primary_tenant_id(user: User) -> Optional[str]:
    """
    Get the user's primary tenant ID.
    
    This replaces all direct usage of current_user.tenant_id throughout the codebase.
    
    Args:
        user: The user to get primary tenant for
        
    Returns:
        str: Primary tenant ID, or None if user has no primary tenant
        
    SSO_FUTURE: Will handle SSO users who may have multiple primary tenants
    across different identity providers.
    """
    if user.is_msp_user:
        # MSP users don't have a specific primary tenant
        return None
    
    primary_assignment = user.get_primary_tenant_assignment()
    return primary_assignment.tenant_id if primary_assignment else None


def resolve_tenant_context(
    user: User, 
    tenant_id_param: Optional[str] = None,
    db: Session = None
) -> str:
    """
    Resolve the tenant context for an API request.
    
    This function implements the logic:
    1. If tenant_id parameter provided, validate access and use it
    2. If no tenant_id parameter, use user's primary tenant
    3. Raise error if user has no access to resolved tenant
    
    Args:
        user: Current authenticated user
        tenant_id_param: Optional tenant_id from query parameter
        db: Database session for validation
        
    Returns:
        str: Resolved tenant ID to use for the request
        
    Raises:
        HTTPException: If user doesn't have access to requested tenant
        
    SSO_FUTURE: Will handle domain-based tenant resolution for SSO users
    and validate against Azure AD group memberships.
    """
    if tenant_id_param:
        # Validate user has access to requested tenant
        if not user.has_tenant_access(tenant_id_param):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You don't have access to tenant {tenant_id_param}"
            )
        return tenant_id_param
    
    # Use user's primary tenant
    primary_tenant_id = get_user_primary_tenant_id(user)
    if not primary_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tenant context available. Please specify tenant_id parameter."
        )
    
    return primary_tenant_id


def validate_user_tenant_access(
    user: User, 
    tenant_id: str, 
    required_permission: str,
    db: Session
) -> bool:
    """
    Validate that a user has access to a tenant and specific permission.
    
    Args:
        user: User to validate
        tenant_id: Tenant to check access for
        required_permission: Permission required in the tenant
        db: Database session
        
    Returns:
        bool: True if user has access and permission
        
    SSO_FUTURE: Will validate against Azure AD group memberships and
    SSO-provisioned role assignments.
    """
    # Check basic tenant access
    if not user.has_tenant_access(tenant_id):
        return False
    
    # Check specific permission in tenant
    return has_permission_in_tenant(user, required_permission, tenant_id, db)


def get_user_accessible_tenant_ids(user: User, db: Session) -> List[str]:
    """
    Get list of tenant IDs that a user has access to.
    
    Args:
        user: User to get accessible tenants for
        db: Database session
        
    Returns:
        List[str]: List of tenant IDs user can access
        
    SSO_FUTURE: Will include tenants accessible via Azure AD group memberships
    and cross-tenant SSO scenarios.
    """
    if user.is_msp_user:
        # MSP users have access to all active tenants
        all_tenants = db.query(Tenant).filter(Tenant.is_active == True).all()
        return [tenant.tenant_id for tenant in all_tenants]
    
    # Regular users only have access to their assigned tenants
    accessible_tenants = []
    for assignment in user.get_tenant_assignments():
        accessible_tenants.append(assignment.tenant_id)
    
    return accessible_tenants


def validate_admin_tenant_assignment_permission(
    admin_user: User,
    target_tenant_ids: List[str],
    db: Session
) -> bool:
    """
    Validate that an admin user can assign other users to specific tenants.
    
    Admins can only assign users to tenants they themselves have access to.
    MSP users can assign to any tenant.
    
    Args:
        admin_user: Admin user performing the assignment
        target_tenant_ids: List of tenant IDs to assign user to
        db: Database session
        
    Returns:
        bool: True if admin can assign to all specified tenants
        
    Raises:
        HTTPException: If admin doesn't have permission for any tenant
        
    SSO_FUTURE: Will validate against SSO domain ownership and
    Azure AD tenant administration rights.
    """
    if admin_user.is_msp_user:
        # MSP users can assign to any tenant
        return True
    
    admin_accessible_tenants = set(get_user_accessible_tenant_ids(admin_user, db))
    
    for tenant_id in target_tenant_ids:
        if tenant_id not in admin_accessible_tenants:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"You don't have permission to assign users to tenant {tenant_id}"
            )
    
    return True


def ensure_single_primary_tenant(user_id: int, new_primary_tenant_id: str, db: Session):
    """
    Ensure a user has exactly one primary tenant assignment.
    
    When setting a new primary tenant, this function will:
    1. Remove is_primary=True from all other assignments
    2. Set is_primary=True for the specified tenant
    
    Args:
        user_id: User's internal ID
        new_primary_tenant_id: Tenant ID to set as primary
        db: Database session
        
    SSO_FUTURE: Will handle primary tenant selection for SSO users
    who may have multiple tenant contexts from different identity providers.
    """
    # Remove primary flag from all existing assignments
    db.query(UserTenantAssignment).filter(
        UserTenantAssignment.user_id == user_id,
        UserTenantAssignment.is_primary == True
    ).update({"is_primary": False})
    
    # Set new primary tenant
    db.query(UserTenantAssignment).filter(
        UserTenantAssignment.user_id == user_id,
        UserTenantAssignment.tenant_id == new_primary_tenant_id
    ).update({"is_primary": True})
    
    db.commit()


# SSO_FUTURE: Additional utility functions for SSO implementation

def resolve_tenant_from_domain(email_domain: str, db: Session) -> Optional[str]:
    """
    SSO_FUTURE: Resolve tenant ID from email domain for SSO login flows.
    
    This will enable automatic tenant detection during SSO login:
    user@company.com -> lookup company.com -> return tenant_id
    
    Args:
        email_domain: Domain part of user's email
        db: Database session
        
    Returns:
        Optional[str]: Tenant ID if domain is registered, None otherwise
    """
    # Implementation will be added during SSO phase
    pass


def sync_sso_user_assignments(
    user: User, 
    azure_groups: List[dict], 
    db: Session
) -> List[UserTenantAssignment]:
    """
    SSO_FUTURE: Synchronize user tenant assignments based on Azure AD group memberships.
    
    This will automatically assign/remove users from tenants based on their
    Azure AD group memberships during SSO login or periodic sync.
    
    Args:
        user: User to sync assignments for
        azure_groups: List of Azure AD groups user belongs to
        db: Database session
        
    Returns:
        List[UserTenantAssignment]: Updated assignments
    """
    # Implementation will be added during SSO phase
    pass


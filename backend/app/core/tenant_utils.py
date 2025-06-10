"""
Utility functions for tenant-aware role and permission management.

This module provides helper functions to resolve user roles and permissions
in a multi-tenant context, replacing direct access to user.role.
"""

from typing import List, Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from app.models.user import User, Tenant
from app.models.user_tenant_assignment import UserTenantAssignment
from app.core.permissions import has_permission_in_tenant

def get_user_role_in_tenant(user: User, tenant_id: Optional[str] = None) -> Optional[str]:
    """
    Get the user's role in a specific tenant.
    
    Args:
        user: The user object
        tenant_id: The tenant ID to check role for. If None, uses primary tenant.
        
    Returns:
        The role name (e.g., "admin", "user", "msp") or None if no role found
    """
    if not user:
        return None
        
    # If no tenant_id specified, try to get from user's primary tenant
    if not tenant_id:
        # For MSP users, they typically have a global role
        if user.is_msp_user:
            # Find any MSP role assignment
            for assignment in user.get_tenant_assignments():
                if assignment.role and assignment.role.name == "msp":
                    return "msp"
        
        # Get primary tenant assignment
        primary_assignment = next(
            (assignment for assignment in user.get_tenant_assignments() 
             if assignment.is_primary), 
            None
        )
        if primary_assignment and primary_assignment.role:
            return primary_assignment.role.name
            
        # Fallback to first active assignment
        active_assignment = next(
            (assignment for assignment in user.get_tenant_assignments() 
             if assignment.is_active and assignment.role), 
            None
        )
        if active_assignment:
            return active_assignment.role.name
            
        return None
    
    # Get role for specific tenant
    tenant_assignment = next(
        (assignment for assignment in user.get_tenant_assignments() 
         if assignment.tenant_id == tenant_id), 
        None
    )
    
    if tenant_assignment and tenant_assignment.role:
        return tenant_assignment.role.name
        
    return None


def get_user_permissions_in_tenant(user: User, tenant_id: Optional[str] = None) -> List[str]:
    """
    Get the user's permissions in a specific tenant.
    
    Args:
        user: The user object
        tenant_id: The tenant ID to check permissions for. If None, uses primary tenant.
        
    Returns:
        List of permission names
    """
    if not user:
        return []
        
    # If no tenant_id specified, try to get from user's primary tenant
    if not tenant_id:
        # For MSP users, they typically have a global role
        if user.is_msp_user:
            # Find any MSP role assignment
            for assignment in user.get_tenant_assignments():
                if assignment.role and assignment.role.name == "msp":
                    return [p.name for p in assignment.role.permissions]
        
        # Get primary tenant assignment
        primary_assignment = next(
            (assignment for assignment in user.get_tenant_assignments() 
             if assignment.is_primary), 
            None
        )
        if primary_assignment and primary_assignment.role:
            return [p.name for p in primary_assignment.role.permissions]
            
        # Fallback to first active assignment
        active_assignment = next(
            (assignment for assignment in user.get_tenant_assignments() 
             if assignment.is_active and assignment.role), 
            None
        )
        if active_assignment:
            return [p.name for p in active_assignment.role.permissions]
            
        return []
    
    # Get permissions for specific tenant
    tenant_assignment = next(
        (assignment for assignment in user.get_tenant_assignments() 
         if assignment.tenant_id == tenant_id), 
        None
    )
    
    if tenant_assignment and tenant_assignment.role:
        return [p.name for p in tenant_assignment.role.permissions]
        
    return []


def user_has_permission_in_tenant(user: User, permission: str, tenant_id: Optional[str] = None) -> bool:
    """
    Check if user has a specific permission in a tenant.
    
    Args:
        user: The user object
        permission: The permission name to check
        tenant_id: The tenant ID to check permission for. If None, uses primary tenant.
        
    Returns:
        True if user has the permission, False otherwise
    """
    permissions = get_user_permissions_in_tenant(user, tenant_id)
    return permission in permissions


def user_has_role_in_tenant(user: User, role: str, tenant_id: Optional[str] = None) -> bool:
    """
    Check if user has a specific role in a tenant.
    
    Args:
        user: The user object
        role: The role name to check (e.g., "admin", "user", "msp")
        tenant_id: The tenant ID to check role for. If None, uses primary tenant.
        
    Returns:
        True if user has the role, False otherwise
    """
    user_role = get_user_role_in_tenant(user, tenant_id)
    return user_role == role


def is_admin_or_msp(user: User, tenant_id: Optional[str] = None) -> bool:
    """
    Check if user is admin or MSP in a tenant.
    
    Args:
        user: The user object
        tenant_id: The tenant ID to check role for. If None, uses primary tenant.
        
    Returns:
        True if user is admin or MSP, False otherwise
    """
    role = get_user_role_in_tenant(user, tenant_id)
    return role in ["admin", "msp"]


# Additional utility functions for backward compatibility
def get_user_primary_tenant_id(user: User) -> Optional[str]:
    """
    Get the user's primary tenant ID.
    
    This replaces all direct usage of current_user.tenant_id throughout the codebase.
    
    Args:
        user: The user to get primary tenant for
        
    Returns:
        str: Primary tenant ID, or None if user has no primary tenant
    """
    if user.is_msp_user:
        # MSP users don't have a specific primary tenant
        return None
    
    primary_assignment = user.get_primary_tenant_assignment()
    return primary_assignment.tenant_id if primary_assignment else None


def get_user_role_name_in_tenant(user: "User", tenant_id: str = None) -> str:
    """
    Get the user's role name in a specific tenant.
    
    Args:
        user: The user object
        tenant_id: The tenant ID (if None, uses primary tenant)
        
    Returns:
        str: The role name (e.g., 'admin', 'user', 'msp') or None
    """
    if tenant_id is None:
        # Get primary tenant
        primary_assignment = user.get_primary_tenant_assignment()
        tenant_id = primary_assignment.tenant_id if primary_assignment else None
    
    if not tenant_id:
        return None
        
    return get_user_role_in_tenant(user, tenant_id)


def user_has_role_in_tenant(user: "User", role_name: str, tenant_id: str = None) -> bool:
    """
    Check if user has a specific role in a tenant.
    
    Args:
        user: The user object
        role_name: The role name to check (e.g., 'admin', 'msp')
        tenant_id: The tenant ID (if None, uses primary tenant)
        
    Returns:
        bool: True if user has the role in the tenant
    """
    current_role = get_user_role_name_in_tenant(user, tenant_id)
    return current_role == role_name


def user_has_admin_or_msp_role(user: "User", tenant_id: str = None) -> bool:
    """
    Check if user has admin or msp role in a tenant.
    Common pattern used throughout the codebase.
    
    Args:
        user: The user object
        tenant_id: The tenant ID (if None, uses primary tenant)
        
    Returns:
        bool: True if user has admin or msp role
    """
    role_name = get_user_role_name_in_tenant(user, tenant_id)
    return role_name in ["admin", "msp"]


def get_user_permissions_list(user: "User", tenant_id: str = None) -> List[str]:
    """
    Get a list of permission names for a user in a specific tenant.
    
    Args:
        user: The user object
        tenant_id: The tenant ID (if None, uses primary tenant)
        
    Returns:
        List[str]: List of permission names
    """
    if tenant_id is None:
        # Get primary tenant
        primary_assignment = user.get_primary_tenant_assignment()
        tenant_id = primary_assignment.tenant_id if primary_assignment else None
    
    if not tenant_id:
        return []
    
    permissions = get_user_permissions_in_tenant(user, tenant_id)
    return list(permissions)


def user_has_any_permission(user: "User", permission_names: List[str], tenant_id: str = None) -> bool:
    """
    Check if user has any of the specified permissions in a tenant.
    
    Args:
        user: The user object
        permission_names: List of permission names to check
        tenant_id: The tenant ID (if None, uses primary tenant)
        
    Returns:
        bool: True if user has any of the permissions
    """
    user_permissions = get_user_permissions_list(user, tenant_id)
    return any(perm in user_permissions for perm in permission_names)


def resolve_tenant_context(user: "User", request_tenant_id: str = None) -> str:
    """
    Resolve the appropriate tenant context for a user.
    
    IMPORTANT: This function now requires explicit tenant_id and does NOT default to primary tenant.
    This ensures proper multi-tenant behavior where users must explicitly specify which tenant 
    context they want to operate in.
    
    Args:
        user: The user object
        request_tenant_id: Tenant ID from request (query param, etc.) - REQUIRED
        
    Returns:
        str: The resolved tenant ID if valid, None if invalid/missing
        
    Raises:
        No exceptions - returns None for invalid cases, let calling endpoint handle error
    """
    # Tenant ID is now required - no defaulting to primary tenant
    if not request_tenant_id:
        return None
    
    # Validate user has access to the requested tenant
    if not user.has_tenant_access(request_tenant_id):
        return None
    
    return request_tenant_id

def get_user_accessible_tenant_ids(user: User, db: Session) -> List[str]:
    """
    Get list of tenant IDs that a user has access to.
    
    Args:
        user: User to get accessible tenants for
        db: Database session
        
    Returns:
        List[str]: List of tenant IDs user can access
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

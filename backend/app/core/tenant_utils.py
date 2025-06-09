"""
Utility functions for tenant-aware role and permission management.

This module provides helper functions to resolve user roles and permissions
in a multi-tenant context, replacing direct access to user.role.
"""

from typing import List, Optional
from app.models.user import User


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


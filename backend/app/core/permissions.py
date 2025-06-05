"""
Permission resolution and checking utilities.

This module provides functions to resolve user permissions from both role-based
permissions and individual user permissions, and to check if a user has specific
permissions.
"""

from typing import List, Set
from sqlalchemy.orm import Session, joinedload
from app.models.user import User, Permission


def get_user_permissions(user: User, db: Session) -> Set[str]:
    """
    Get all permissions for a user, combining role-based and individual permissions.
    
    Args:
        user: The user object
        db: Database session
        
    Returns:
        Set of permission names that the user has
    """
    permissions = set()
    
    # Get role-based permissions
    if user.role and user.role.permissions:
        role_permissions = {p.name for p in user.role.permissions}
        permissions.update(role_permissions)
    
    # Get individual permissions
    # Refresh user with individual permissions if not already loaded
    if not hasattr(user, 'individual_permissions') or user.individual_permissions is None:
        user = db.query(User).options(
            joinedload(User.individual_permissions),
            joinedload(User.role).joinedload(Permission.roles)
        ).filter(User.id == user.id).first()
    
    if user.individual_permissions:
        individual_permissions = {p.name for p in user.individual_permissions}
        permissions.update(individual_permissions)
    
    return permissions


def has_permission(user: User, permission_name: str, db: Session) -> bool:
    """
    Check if a user has a specific permission.
    
    Args:
        user: The user object
        permission_name: Name of the permission to check
        db: Database session
        
    Returns:
        True if user has the permission, False otherwise
    """
    user_permissions = get_user_permissions(user, db)
    return permission_name in user_permissions


def has_any_permission(user: User, permission_names: List[str], db: Session) -> bool:
    """
    Check if a user has any of the specified permissions.
    
    Args:
        user: The user object
        permission_names: List of permission names to check
        db: Database session
        
    Returns:
        True if user has at least one of the permissions, False otherwise
    """
    user_permissions = get_user_permissions(user, db)
    return any(perm in user_permissions for perm in permission_names)


def has_all_permissions(user: User, permission_names: List[str], db: Session) -> bool:
    """
    Check if a user has all of the specified permissions.
    
    Args:
        user: The user object
        permission_names: List of permission names to check
        db: Database session
        
    Returns:
        True if user has all of the permissions, False otherwise
    """
    user_permissions = get_user_permissions(user, db)
    return all(perm in user_permissions for perm in permission_names)


def is_admin_or_msp(user: User) -> bool:
    """
    Check if a user is an admin or MSP user.
    
    Args:
        user: The user object
        
    Returns:
        True if user is admin or MSP, False otherwise
    """
    return user.role and user.role.name in ["admin", "msp"]


def can_access_tenant(user: User, tenant_id: str) -> bool:
    """
    Check if a user can access a specific tenant.
    
    Args:
        user: The user object
        tenant_id: The tenant ID to check access for
        
    Returns:
        True if user can access the tenant, False otherwise
    """
    # Admin and MSP users can access all tenants
    if is_admin_or_msp(user):
        return True
    
    # Regular users can only access their own tenant
    return user.tenant_id == tenant_id


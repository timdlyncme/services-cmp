"""
Permission management and checking utilities for multi-tenant authorization.

This module provides utilities for:
- Categorizing permissions as global vs tenant-scoped
- Checking user permissions within tenant context
- Managing MSP vs tenant user access patterns
"""

from typing import List, Optional, Set
from sqlalchemy.orm import Session
from app.models.user import User, Permission
from app.models.user_tenant_assignment import UserTenantAssignment


# Global permissions that apply across all tenants (primarily for MSP users)
GLOBAL_PERMISSIONS = {
    "view:all-tenants",
    "list:all-tenants",
    "create:tenants", 
    "update:tenants",
    "delete:tenants",
    "view:msp-users",
    "list:msp-users",
    "create:msp-users",
    "update:msp-users", 
    "delete:msp-users",
    "manage:global-settings",
    "view:platform-analytics",
    "list:platform-analytics"
}

# Tenant-scoped permissions that apply within specific tenants
TENANT_SCOPED_PERMISSIONS = {
    "view:users",
    "list:users",
    "create:users", 
    "update:users",
    "delete:users",
    "view:cloud-accounts",
    "list:cloud-accounts",
    "create:cloud-accounts",
    "update:cloud-accounts", 
    "delete:cloud-accounts",
    "view:environments",
    "list:environments",
    "create:environments",
    "update:environments",
    "delete:environments",
    "view:catalog",
    "list:catalog",
    "view:templates",
    "list:templates",
    "create:templates",
    "update:templates",
    "delete:templates",
    "view:template-foundry",
    "list:template-foundry",
    "create:template-foundry",
    "update:template-foundry",
    "delete:template-foundry",
    "view:deployments",
    "list:deployments",
    "create:deployments",
    "update:deployments",
    "delete:deployments",
    "manage:deployments",
    "view:settings",
    "list:settings",
    "update:settings",
    "use:ai_assistant",
    "use:nexus_ai",
    "manage:nexus_ai"
}

# Updated role permissions mapping
ROLE_PERMISSIONS = {
    "user": {
        "tenant_scoped": [
            "view:catalog", "list:catalog", "list:environments", "list:cloud-accounts", "view:deployments", "list:deployments",
            "create:deployments", "update:deployments", "delete:deployments", "use:ai_assistant"
        ],
        "global": []
    },
    "admin": {
        "tenant_scoped": [
            "view:users", "list:users", "create:users", "update:users", "delete:users",
            "view:cloud-accounts", "list:cloud-accounts", "create:cloud-accounts", "update:cloud-accounts", "delete:cloud-accounts",
            "view:environments", "list:environments", "create:environments", "update:environments", "delete:environments",
            "view:catalog", "list:catalog", "view:templates", "list:templates", "create:templates", "update:templates", "delete:templates",
            "view:template-foundry", "list:template-foundry", "create:template-foundry", "update:template-foundry", "delete:template-foundry",
            "view:deployments", "list:deployments", "create:deployments", "update:deployments", "delete:deployments", "manage:deployments",
            "view:settings", "list:settings", "update:settings", "use:ai_assistant", "use:nexus_ai", "manage:nexus_ai"
        ],
        "global": []
    },
    "msp": {
        "tenant_scoped": [
            "view:users", "list:users", "create:users", "update:users", "delete:users",
            "view:cloud-accounts", "list:cloud-accounts", "create:cloud-accounts", "update:cloud-accounts", "delete:cloud-accounts",
            "view:environments", "list:environments", "create:environments", "update:environments", "delete:environments",
            "view:catalog", "list:catalog", "view:templates", "list:templates", "create:templates", "update:templates", "delete:templates",
            "view:template-foundry", "list:template-foundry", "create:template-foundry", "update:template-foundry", "delete:template-foundry",
            "view:deployments", "list:deployments", "create:deployments", "update:deployments", "delete:deployments", "manage:deployments",
            "view:settings", "list:settings", "update:settings", "use:ai_assistant", "use:nexus_ai", "manage:nexus_ai"
        ],
        "global": [
            "view:all-tenants", "list:all-tenants", "create:tenants", "update:tenants", "delete:tenants",
            "view:msp-users", "list:msp-users", "create:msp-users", "update:msp-users", "delete:msp-users",
            "manage:global-settings", "view:platform-analytics", "list:platform-analytics"
        ]
    }
}


def is_global_permission(permission_name: str) -> bool:
    """Check if a permission is global (cross-tenant) or tenant-scoped."""
    return permission_name in GLOBAL_PERMISSIONS


def is_tenant_scoped_permission(permission_name: str) -> bool:
    """Check if a permission is tenant-scoped."""
    return permission_name in TENANT_SCOPED_PERMISSIONS


def has_permission_in_tenant(
    user: User, 
    permission_name: str, 
    tenant_id: str,
    db: Session
) -> bool:
    """
    Check if a user has a specific permission within a specific tenant context.
    
    Args:
        user: The user to check permissions for
        permission_name: The permission to check (e.g., "view:users")
        tenant_id: The tenant context to check within
        db: Database session
        
    Returns:
        bool: True if user has the permission in the tenant context
    """
    # Import here to avoid circular imports
    from app.core.tenant_utils import get_user_role_in_tenant, user_has_permission_in_tenant
    
    # MSP users have global access to all tenants
    if user.is_msp_user:
        # Check if user has the permission through their tenant assignments
        return user_has_permission_in_tenant(user, permission_name, tenant_id)
    
    # For non-MSP users, check tenant-specific assignment
    if is_global_permission(permission_name):
        # Regular users don't have global permissions
        return False
    
    # Check if user has access to this tenant
    if not user.has_tenant_access(tenant_id):
        return False
    
    # Use the tenant utils function to check permission
    return user_has_permission_in_tenant(user, permission_name, tenant_id)


def has_global_permission(user: User, permission_name: str) -> bool:
    """
    Check if a user has a global permission (cross-tenant access).
    
    Args:
        user: The user to check permissions for
        permission_name: The global permission to check
        
    Returns:
        bool: True if user has the global permission
    """
    # Only MSP users can have global permissions
    if not user.is_msp_user:
        return False
    
    if not is_global_permission(permission_name):
        return False
    
    # Check if user has the global permission through any of their tenant assignments
    # MSP users typically have admin/msp roles that include global permissions
    from app.core.tenant_utils import get_user_role_in_tenant
    
    # For MSP users, check if they have admin/msp role in any tenant
    for assignment in user.get_tenant_assignments():
        role_name = get_user_role_in_tenant(user, assignment.tenant_id)
        if role_name in ["admin", "msp"]:
            # Get role permissions from the assignment
            if assignment.role and assignment.role.permissions:
                user_permissions = {p.name for p in assignment.role.permissions}
                if permission_name in user_permissions:
                    return True
    
    return False


def get_user_permissions_in_tenant(user: User, tenant_id: str) -> Set[str]:
    """
    Get all permissions a user has within a specific tenant.
    
    Args:
        user: The user to get permissions for
        tenant_id: The tenant context
        
    Returns:
        Set[str]: Set of permission names the user has in the tenant
    """
    permissions = set()
    
    # Use the new tenant-based permission system
    from app.core.tenant_utils import get_user_permissions_in_tenant as get_tenant_perms
    
    # Get permissions through tenant assignments
    tenant_permissions = get_tenant_perms(user, tenant_id)
    permissions.update(tenant_permissions)
    
    return permissions


def get_user_accessible_tenants(user: User, db: Session) -> List[str]:
    """
    Get list of tenant IDs that a user has access to.
    
    Args:
        user: The user to check
        db: Database session
        
    Returns:
        List[str]: List of tenant IDs the user can access
    """
    # MSP users have access to all tenants
    if user.is_msp_user:
        from app.models.user import Tenant
        all_tenants = db.query(Tenant).filter(Tenant.is_active == True).all()
        return [tenant.tenant_id for tenant in all_tenants]
    
    # Regular users only have access to their assigned tenants
    accessible_tenants = []
    for assignment in user.get_tenant_assignments():
        accessible_tenants.append(assignment.tenant_id)
    
    return accessible_tenants


def can_user_switch_to_tenant(user: User, tenant_id: str) -> bool:
    """
    Check if a user can switch to a specific tenant.
    
    Args:
        user: The user to check
        tenant_id: The target tenant ID
        
    Returns:
        bool: True if user can switch to the tenant
    """
    return user.has_tenant_access(tenant_id)


def get_user_role_name(user: User, tenant_id: str = None) -> Optional[str]:
    """
    Get the user's role name in a specific tenant context.
    
    Args:
        user: The user to check
        tenant_id: The tenant context
        
    Returns:
        Optional[str]: Role name in the tenant, or None if no access
    """
    from app.core.tenant_utils import get_user_role_in_tenant
    
    if tenant_id is None:
        # Get primary tenant
        primary_assignment = user.get_primary_tenant_assignment()
        tenant_id = primary_assignment.tenant_id if primary_assignment else None
    
    if not tenant_id:
        return None
        
    return get_user_role_in_tenant(user, tenant_id)

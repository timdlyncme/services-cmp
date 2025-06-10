#!/usr/bin/env python3
"""
Script to fix multi-tenant authorization issues in deployments.py
"""

import re

def fix_deployments_file():
    """Fix all admin bypasses and implement proper tenant context resolution"""
    
    with open('backend/app/api/endpoints/deployments.py', 'r') as f:
        content = f.read()
    
    # Pattern 1: Fix get_azure_credentials function (around line 90)
    content = re.sub(
        r'(\s+)# Check if user has permission to view credentials for this tenant\s*\n'
        r'(\s+)if creds_tenant_id != current_user\.tenant\.tenant_id:\s*\n'
        r'(\s+)# Only admin or MSP users can view credentials for other tenants\s*\n'
        r'(\s+)if not user_has_admin_or_msp_role\(current_user, tenant_id\):\s*\n'
        r'(\s+)raise HTTPException\(\s*\n'
        r'(\s+)status_code=status\.HTTP_403_FORBIDDEN,\s*\n'
        r'(\s+)detail="Not authorized to view credentials for other tenants"\s*\n',
        r'\1# Check if user has access to this tenant\n'
        r'\1if not current_user.has_tenant_access(tenant.tenant_id):\n'
        r'\1    logger.warning(f"User {current_user.username} does not have access to tenant {creds_tenant_id}")\n'
        r'\1    raise HTTPException(\n'
        r'\1        status_code=status.HTTP_403_FORBIDDEN,\n'
        r'\1        detail="Not authorized to view credentials for this tenant"\n'
        r'\1    )\n',
        content,
        flags=re.MULTILINE
    )
    
    # Pattern 2: Replace tenant_id resolution with resolve_tenant_context
    content = re.sub(
        r'(\s+)# Use the provided tenant_id if it exists, otherwise use the current user\'s tenant\s*\n'
        r'(\s+)creds_tenant_id = tenant_id if tenant_id else current_user\.tenant\.tenant_id\s*\n',
        r'\1# Resolve tenant context - require explicit tenant_id\n'
        r'\1resolved_tenant_id = resolve_tenant_context(current_user, tenant_id)\n',
        content,
        flags=re.MULTILINE
    )
    
    # Pattern 3: Replace creds_tenant_id with resolved_tenant_id
    content = content.replace('creds_tenant_id', 'resolved_tenant_id')
    
    # Pattern 4: Fix get_deployments function - replace admin bypass with requirement for explicit tenant
    content = re.sub(
        r'(\s+)# No tenant specified, show deployments from the user\'s tenant\s*\n'
        r'(\s+)if user_has_admin_or_msp_role\(current_user, tenant_id\):\s*\n'
        r'(\s+)# Admin and MSP users can see all deployments if no tenant is specified\s*\n'
        r'(\s+)pass\s*\n'
        r'(\s+)else:\s*\n'
        r'(\s+)# Regular users can only see deployments from their tenant\s*\n'
        r'(\s+)if user_tenant:\s*\n'
        r'(\s+)query = query\.filter\(Tenant\.tenant_id == user_tenant\.tenant_id\)\s*\n',
        r'\1# No tenant specified - require explicit tenant access\n'
        r'\1# Users must specify a tenant they have access to\n'
        r'\1raise HTTPException(\n'
        r'\1    status_code=status.HTTP_400_BAD_REQUEST,\n'
        r'\1    detail="You must specify a tenant_id to view deployments"\n'
        r'\1)\n',
        content,
        flags=re.MULTILINE
    )
    
    # Pattern 5: Fix list_azure_subscriptions - replace account_tenant_id logic
    content = re.sub(
        r'(\s+)# Use the provided tenant_id if it exists, otherwise use the current user\'s tenant\s*\n'
        r'(\s+)account_tenant_id = tenant_id if tenant_id else current_user\.tenant\.tenant_id\s*\n',
        r'\1# Resolve tenant context - require explicit tenant_id\n'
        r'\1resolved_tenant_id = resolve_tenant_context(current_user, tenant_id)\n',
        content,
        flags=re.MULTILINE
    )
    
    # Replace account_tenant_id with resolved_tenant_id
    content = content.replace('account_tenant_id', 'resolved_tenant_id')
    
    # Pattern 6: Fix all remaining admin bypass patterns
    content = re.sub(
        r'(\s+)# Check if user has permission to .* for this tenant\s*\n'
        r'(\s+)if [^:]+!= current_user\.tenant\.tenant_id:\s*\n'
        r'(\s+)# Only admin or MSP users can .* for other tenants\s*\n'
        r'(\s+)if not user_has_admin_or_msp_role\(current_user, tenant_id\):\s*\n'
        r'(\s+)raise HTTPException\(\s*\n'
        r'(\s+)status_code=status\.HTTP_403_FORBIDDEN,\s*\n'
        r'(\s+)detail="Not authorized to .* for other tenants"\s*\n',
        r'\1# Check if user has access to this tenant\n'
        r'\1if not current_user.has_tenant_access(tenant.tenant_id):\n'
        r'\1    logger.warning(f"User {current_user.username} does not have access to tenant {resolved_tenant_id}")\n'
        r'\1    raise HTTPException(\n'
        r'\1        status_code=status.HTTP_403_FORBIDDEN,\n'
        r'\1        detail="Not authorized to access this tenant"\n'
        r'\1    )\n',
        content,
        flags=re.MULTILINE
    )
    
    # Update permission checks to use resolved_tenant_id
    content = re.sub(
        r'user_has_any_permission\(current_user, \[([^\]]+)\], tenant_id\)',
        r'user_has_any_permission(current_user, [\1], resolved_tenant_id)',
        content
    )
    
    # Write the fixed content back
    with open('backend/app/api/endpoints/deployments.py', 'w') as f:
        f.write(content)
    
    print("Fixed all admin bypasses and implemented proper tenant context resolution")

if __name__ == "__main__":
    fix_deployments_file()


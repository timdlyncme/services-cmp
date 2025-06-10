#!/usr/bin/env python3
"""
Debug script to investigate the template catalog issue for non-primary tenants.
"""

import sys
import os
sys.path.append('/workspace/backend')

from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.user import User, Tenant
from app.models.deployment import Template
from app.core.tenant_utils import (
    user_has_any_permission,
    get_user_role_name_in_tenant,
    user_has_admin_or_msp_role
)

def debug_template_issue():
    """Debug the template catalog issue"""
    db = SessionLocal()
    
    try:
        print("=== Debugging Template Catalog Issue ===\n")
        
        # Find users with multiple tenant assignments
        print("1. Finding users with multiple tenant assignments...")
        users_with_multiple_tenants = []
        
        for user in db.query(User).all():
            tenant_assignments = user.get_tenant_assignments()
            if len(tenant_assignments) > 1:
                users_with_multiple_tenants.append(user)
                print(f"User {user.username} ({user.id}) has {len(tenant_assignments)} tenant assignments:")
                for assignment in tenant_assignments:
                    print(f"  - Tenant: {assignment.tenant_id}, Role: {assignment.role.name if assignment.role else 'None'}, Primary: {assignment.is_primary}")
        
        if not users_with_multiple_tenants:
            print("No users found with multiple tenant assignments.")
            return
        
        # Test with the first user found
        test_user = users_with_multiple_tenants[0]
        print(f"\n2. Testing with user: {test_user.username} ({test_user.id})")
        
        # Get their tenant assignments
        assignments = test_user.get_tenant_assignments()
        primary_assignment = test_user.get_primary_tenant_assignment()
        
        print(f"Primary tenant: {primary_assignment.tenant_id if primary_assignment else 'None'}")
        
        # Test each tenant assignment
        for assignment in assignments:
            tenant_id = assignment.tenant_id
            is_primary = assignment.is_primary
            
            print(f"\n3. Testing tenant {tenant_id} (Primary: {is_primary}):")
            
            # Check permissions
            has_list_templates = user_has_any_permission(test_user, ["list:templates"], tenant_id)
            has_list_catalog = user_has_any_permission(test_user, ["list:catalog"], tenant_id)
            has_any_permission = user_has_any_permission(test_user, ["list:templates", "list:catalog"], tenant_id)
            
            print(f"  - Has 'list:templates': {has_list_templates}")
            print(f"  - Has 'list:catalog': {has_list_catalog}")
            print(f"  - Has any permission: {has_any_permission}")
            
            # Check role
            role_name = get_user_role_name_in_tenant(test_user, tenant_id)
            print(f"  - Role in tenant: {role_name}")
            
            # Check admin/msp role
            is_admin_or_msp = user_has_admin_or_msp_role(test_user, tenant_id)
            print(f"  - Is admin or MSP: {is_admin_or_msp}")
            
            # Check tenant access
            has_tenant_access = test_user.has_tenant_access(tenant_id)
            print(f"  - Has tenant access: {has_tenant_access}")
            
            # Check templates in this tenant
            templates_count = db.query(Template).filter(Template.tenant_id == tenant_id).count()
            print(f"  - Templates in tenant: {templates_count}")
            
            # Simulate the permission check from the API
            try:
                # This is the exact check from the API
                has_permission = user_has_any_permission(test_user, ["list:templates", "list:catalog"], tenant_id)
                if not has_permission:
                    print(f"  - ❌ Permission check FAILED - this would cause 403")
                else:
                    print(f"  - ✅ Permission check PASSED")
                    
                    # Now check the tenant lookup logic
                    tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
                    if not tenant:
                        print(f"  - ❌ Tenant lookup FAILED - tenant not found")
                    else:
                        print(f"  - ✅ Tenant lookup PASSED")
                        
                        # Check user tenant lookup
                        user_tenant = db.query(Tenant).filter(Tenant.tenant_id == test_user.tenant_id).first()
                        if not user_tenant:
                            print(f"  - ❌ User tenant lookup FAILED - this could be the issue!")
                            print(f"  - User's tenant_id attribute: {test_user.tenant_id}")
                            print(f"  - User's primary tenant ID: {test_user.get_primary_tenant_id()}")
                        else:
                            print(f"  - ✅ User tenant lookup PASSED")
                            
                            # Check the authorization logic
                            if not user_has_admin_or_msp_role(test_user, tenant_id):
                                if tenant.tenant_id != user_tenant.tenant_id:
                                    print(f"  - ❌ Authorization FAILED - tenant mismatch")
                                    print(f"    - Requested tenant: {tenant.tenant_id}")
                                    print(f"    - User's tenant: {user_tenant.tenant_id}")
                                else:
                                    print(f"  - ✅ Authorization PASSED")
                            else:
                                print(f"  - ✅ Authorization PASSED (admin/msp)")
                        
            except Exception as e:
                print(f"  - ❌ Exception during permission check: {str(e)}")
                import traceback
                traceback.print_exc()
        
        print(f"\n4. Checking user.tenant_id vs primary tenant assignment:")
        print(f"  - user.tenant_id: {test_user.tenant_id}")
        print(f"  - Primary tenant ID: {test_user.get_primary_tenant_id()}")
        
        if test_user.tenant_id != test_user.get_primary_tenant_id():
            print("  - ❌ MISMATCH DETECTED! This is likely the root cause.")
            print("  - The user.tenant_id field doesn't match their primary tenant assignment.")
        else:
            print("  - ✅ tenant_id matches primary tenant assignment")
            
    except Exception as e:
        print(f"Error during debugging: {str(e)}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    debug_template_issue()


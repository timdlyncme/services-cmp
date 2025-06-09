from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Query
from sqlalchemy.orm import Session
import uuid

from app.api.endpoints.auth import get_current_user
from app.db.session import get_db
from app.models.user import User, Tenant, Role
from app.models.user_tenant_assignment import UserTenantAssignment
from app.schemas.user import UserCreate, UserUpdate, UserResponse, TenantAssignmentCreate, TenantAssignmentResponse
from app.core.security import get_password_hash
from app.core.permissions import (
    has_permission_in_tenant, 
    get_user_accessible_tenants,
    has_global_permission
)
from app.core.tenant_utils import (
    resolve_tenant_context,
    get_user_accessible_tenant_ids,
    validate_admin_tenant_assignment_permission,
    ensure_single_primary_tenant
)

router = APIRouter()


@router.get("/", response_model=List[UserResponse])
def get_users(
    tenant_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get all users for the current user's tenant or a specific tenant.
    MSP users can see all users across all tenants.
    Regular users can only see users in their assigned tenants.
    """
    # Determine which tenant to query
    target_tenant_id = tenant_id
    if not target_tenant_id:
        # Default to user's primary tenant
        primary_assignment = current_user.get_primary_tenant_assignment()
        target_tenant_id = primary_assignment.tenant_id if primary_assignment else None
    
    if not target_tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No tenant specified and user has no primary tenant"
        )
    
    # Check permissions
    if not has_permission_in_tenant(current_user, "list:users", target_tenant_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to view users in this tenant"
        )
    
    try:
        # MSP users can see all users, including MSP users
        if current_user.is_msp_user:
            if tenant_id == "msp" or not tenant_id:
                # Show MSP users
                users = db.query(User).filter(User.is_msp_user == True).all()
            else:
                # Show users assigned to specific tenant
                user_assignments = db.query(UserTenantAssignment).filter(
                    UserTenantAssignment.tenant_id == target_tenant_id,
                    UserTenantAssignment.is_active == True
                ).all()
                user_ids = [assignment.user_id for assignment in user_assignments]
                users = db.query(User).filter(User.id.in_(user_ids)).all()  # Use User.id instead of User.user_id
        else:
            # Regular users can only see non-MSP users in their assigned tenants
            user_assignments = db.query(UserTenantAssignment).filter(
                UserTenantAssignment.tenant_id == target_tenant_id,
                UserTenantAssignment.is_active == True
            ).all()
            user_ids = [assignment.user_id for assignment in user_assignments]
            users = db.query(User).filter(
                User.id.in_(user_ids),  # Use User.id instead of User.user_id
                User.is_msp_user == False  # Regular users can't see MSP users
            ).all()
        
        # Convert to response format
        result = []
        for user in users:
            # Get user's role in this tenant (or global role for MSP users)
            role_name = None
            if user.is_msp_user:
                role_name = user.role.name if user.role else None
            else:
                role_in_tenant = user.get_role_in_tenant(target_tenant_id)
                role_name = role_in_tenant.name if role_in_tenant else None
            
            # Get all tenant assignments for this user
            tenant_assignments = []
            user_tenant_assignments = db.query(UserTenantAssignment).filter(
                UserTenantAssignment.user_id == user.id,
                UserTenantAssignment.is_active == True
            ).all()
            
            for assignment in user_tenant_assignments:
                # Get tenant name
                tenant = db.query(Tenant).filter(Tenant.tenant_id == assignment.tenant_id).first()
                tenant_name = tenant.name if tenant else assignment.tenant_id
                
                # Get role name
                role = db.query(Role).filter(Role.id == assignment.role_id).first()
                role_name_for_tenant = role.name if role else None
                
                tenant_assignments.append(
                    TenantAssignmentResponse(
                        tenant_id=assignment.tenant_id,
                        tenant_name=tenant_name,
                        role_id=assignment.role_id,
                        role_name=role_name_for_tenant,
                        is_primary=assignment.is_primary,
                        is_active=assignment.is_active,
                        provisioned_via=assignment.provisioned_via,
                        external_group_id=assignment.external_group_id,
                        external_role_mapping=assignment.external_role_mapping
                    )
                )
            
            # Get primary tenant ID
            primary_assignment = next((a for a in user_tenant_assignments if a.is_primary), None)
            primary_tenant_id = primary_assignment.tenant_id if primary_assignment else None
            
            result.append(
                UserResponse(
                    id=user.user_id,
                    user_id=user.user_id,
                    username=user.username,
                    full_name=user.full_name,
                    email=user.email,
                    is_active=user.is_active,
                    role=role_name,
                    tenant_id=target_tenant_id if not user.is_msp_user else "msp",
                    tenant_assignments=tenant_assignments,
                    primary_tenant_id=primary_tenant_id,
                    is_msp_user=user.is_msp_user,
                    external_id=user.external_id,
                    identity_provider=user.identity_provider,
                    is_sso_user=user.is_sso_user
                )
            )
        
        return result
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving users: {str(e)}"
        )


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: str,  # Changed from int to str to accept UUID
    tenant_id: Optional[str] = Query(None, description="Tenant ID context for the operation"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get a specific user by UUID with multi-tenant access control.
    
    SSO_FUTURE: Will include SSO user information and external identity details.
    """
    # Resolve tenant context for permission checking
    operation_tenant_id = resolve_tenant_context(current_user, tenant_id, db)
    
    # Check if user has permission to view users in the tenant
    if not has_permission_in_tenant(current_user, "list:users", operation_tenant_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to view users in this tenant"
        )
    
    try:
        # Look up user by UUID (user_id field), not internal integer id
        user = db.query(User).filter(User.user_id == user_id).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found"
            )
        
        # Check if current user has access to view this user
        # MSP users can view all users, admins can view users in their accessible tenants
        if not current_user.is_msp_user:
            # Check if the target user has any tenant assignments that the current user can access
            current_user_accessible_tenants = set(get_user_accessible_tenant_ids(current_user, db))
            target_user_tenant_ids = set([assignment.tenant_id for assignment in user.get_tenant_assignments()])
            
            # If there's no overlap in accessible tenants, deny access
            if not current_user_accessible_tenants.intersection(target_user_tenant_ids):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to access this user"
                )
        
        # Convert role object to role name
        role_name = None
        if hasattr(user, 'role') and user.role:
            role_name = user.role.name
        
        # Get tenant_id from tenant object
        tenant_id = None
        if hasattr(user, 'tenant') and user.tenant:
            tenant_id = user.tenant.tenant_id
        
        return UserResponse(
            id=user.user_id,  # Use UUID as id, not internal integer
            user_id=user.user_id,
            username=user.username,
            full_name=user.full_name,
            email=user.email,
            is_active=user.is_active,
            role=role_name,
            tenant_id=tenant_id,
            primary_tenant_id=user.get_primary_tenant_id(),  # Backward compatibility
            tenant_assignments=[],  # Will be populated with actual assignments
            is_msp_user=user.is_msp_user,
            # SSO_FUTURE: SSO user information
            external_id=user.external_id,
            identity_provider=user.identity_provider,
            is_sso_user=user.is_sso_user
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving user: {str(e)}"
        )


@router.post("/", response_model=UserResponse)
def create_user(
    user: UserCreate,
    tenant_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Create a new user with multi-tenant support.
    MSP users can create both MSP and regular users.
    Regular users can only create users in their assigned tenants.
    """
    # Determine target tenant
    target_tenant_id = tenant_id or user.tenant_id
    if not target_tenant_id and not user.is_msp_user:
        # Default to current user's primary tenant for regular users
        primary_assignment = current_user.get_primary_tenant_assignment()
        target_tenant_id = primary_assignment.tenant_id if primary_assignment else None
    
    # Check permissions
    if user.is_msp_user:
        # Creating MSP user requires global permission
        if not has_global_permission(current_user, "create:msp-users"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to create MSP users"
            )
    else:
        # Creating regular user requires tenant permission
        if not target_tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tenant ID required for non-MSP users"
            )
        
        if not has_permission_in_tenant(current_user, "create:users", target_tenant_id, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to create users in this tenant"
            )
    
    try:
        # Check if username or email already exists
        existing_user = db.query(User).filter(
            (User.username == user.username) | (User.email == user.email)
        ).first()
        
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username or email already registered"
            )
        
        # Get role
        role = db.query(Role).filter(Role.name == user.role).first()
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Role '{user.role}' not found"
            )
        
        # Validate role assignment
        if user.is_msp_user and role.name != "msp":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MSP users must have MSP role"
            )
        elif not user.is_msp_user and role.name == "msp":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Non-MSP users cannot have MSP role"
            )
        
        # Create new user
        new_user = User(
            username=user.username,
            full_name=user.full_name,
            email=user.email,
            hashed_password=get_password_hash(user.password),
            role_id=role.id,
            is_active=user.is_active,
            is_msp_user=user.is_msp_user,
            user_id=str(uuid.uuid4())
        )
        
        # Set legacy tenant_id for backward compatibility
        if target_tenant_id:
            new_user.tenant_id = target_tenant_id
        
        db.add(new_user)
        db.flush()  # Get the user ID
        
        # Create tenant assignments for non-MSP users
        if not user.is_msp_user:
            # Use new tenant_assignments structure if provided
            if user.tenant_assignments:
                for assignment in user.tenant_assignments:
                    tenant_assignment = UserTenantAssignment(
                        user_id=new_user.id,
                        tenant_id=assignment.tenant_id,
                        role_id=assignment.role_id or role.id,  # Use specified role or default
                        is_primary=assignment.is_primary,
                        is_active=assignment.is_active,
                        provisioned_via=assignment.provisioned_via or "manual",
                        external_group_id=assignment.external_group_id,
                        external_role_mapping=assignment.external_role_mapping
                    )
                    db.add(tenant_assignment)
            else:
                # Fallback: Create primary tenant assignment
                primary_assignment = UserTenantAssignment(
                    user_id=new_user.id,  # Use integer primary key instead of UUID
                    tenant_id=target_tenant_id,
                    role_id=role.id,
                    is_primary=True,
                    is_active=True
                )
                db.add(primary_assignment)
                
                # Create additional tenant assignments if specified (backward compatibility)
                if hasattr(user, 'additional_tenant_ids') and user.additional_tenant_ids:
                    for additional_tenant_id in user.additional_tenant_ids:
                        if additional_tenant_id != target_tenant_id:  # Don't duplicate primary
                            additional_assignment = UserTenantAssignment(
                                user_id=new_user.id,  # Use integer primary key instead of UUID
                                tenant_id=additional_tenant_id,
                                role_id=role.id,
                                is_primary=False,
                                is_active=True
                            )
                            db.add(additional_assignment)
        else:
            # MSP users get assignments to all tenants
            all_tenants = db.query(Tenant).filter(Tenant.is_active == True).all()
            for i, tenant in enumerate(all_tenants):
                msp_assignment = UserTenantAssignment(
                    user_id=new_user.id,  # Use integer primary key instead of UUID
                    tenant_id=tenant.tenant_id,
                    role_id=role.id,
                    is_primary=(i == 0),  # First tenant is primary
                    is_active=True
                )
                db.add(msp_assignment)
        
        db.commit()
        db.refresh(new_user)
        
        return UserResponse(
            id=new_user.user_id,
            user_id=new_user.user_id,
            username=new_user.username,
            full_name=new_user.full_name,
            email=new_user.email,
            is_active=new_user.is_active,
            role=role.name,
            tenant_id=target_tenant_id if not user.is_msp_user else "msp",
            is_msp_user=new_user.is_msp_user
        )
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating user: {str(e)}"
        )


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,  # Changed from int to str to accept UUID
    user_update: UserUpdate,
    tenant_id: Optional[str] = Query(None, description="Tenant ID context for the operation"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Update a user with multi-tenant assignment support.
    
    SSO_FUTURE: Will handle SSO user updates and external identity synchronization.
    """
    # Resolve tenant context for permission checking
    operation_tenant_id = resolve_tenant_context(current_user, tenant_id, db)
    
    # Check if user has permission to update users in the tenant
    if not has_permission_in_tenant(current_user, "update:users", operation_tenant_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to update users in this tenant"
        )
    
    try:
        # Get the user by UUID (user_id field), not internal integer id
        user = db.query(User).filter(User.user_id == user_id).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found"
            )
        
        # Check if current user has access to update this user
        if not current_user.is_msp_user:
            # Check if the target user has any tenant assignments that the current user can access
            current_user_accessible_tenants = set(get_user_accessible_tenant_ids(current_user, db))
            target_user_tenant_ids = set([assignment.tenant_id for assignment in user.get_tenant_assignments()])
            
            # If there's no overlap in accessible tenants, deny access
            if not current_user_accessible_tenants.intersection(target_user_tenant_ids):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to update this user"
                )
        
        # Update basic user fields
        if user_update.username is not None:
            user.username = user_update.username
        if user_update.full_name is not None:
            user.full_name = user_update.full_name
        if user_update.email is not None:
            user.email = user_update.email
        if user_update.password is not None:
            user.hashed_password = get_password_hash(user_update.password)
        if user_update.is_active is not None:
            user.is_active = user_update.is_active
        if user_update.is_msp_user is not None:
            user.is_msp_user = user_update.is_msp_user
        
        # Handle role updates
        if user_update.role is not None:
            role = db.query(Role).filter(Role.name == user_update.role).first()
            if not role:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Role '{user_update.role}' not found"
                )
            user.role_id = role.id
        
        # Handle tenant assignment updates
        if user_update.tenant_assignments is not None:
            # Validate admin can assign to all specified tenants
            assignment_tenant_ids = [assignment.tenant_id for assignment in user_update.tenant_assignments]
            validate_admin_tenant_assignment_permission(current_user, assignment_tenant_ids, db)
            
            # Remove existing assignments
            db.query(UserTenantAssignment).filter(
                UserTenantAssignment.user_id == user.id
            ).delete()
            
            # Create new assignments
            for assignment in user_update.tenant_assignments:
                # Validate role exists
                assignment_role = db.query(Role).filter(Role.id == assignment.role_id).first()
                if not assignment_role:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Role with ID {assignment.role_id} not found"
                    )
                
                # Create the assignment
                db_assignment = UserTenantAssignment(
                    user_id=user.id,
                    tenant_id=assignment.tenant_id,
                    role_id=assignment.role_id,
                    is_primary=assignment.is_primary,
                    is_active=True,
                    # SSO_FUTURE: Preserve provisioning information during updates
                    provisioned_via="manual",  # Manual updates always marked as manual
                    external_group_id=assignment.external_group_id,
                    external_role_mapping=assignment.external_role_mapping
                )
                db.add(db_assignment)
        
        # Backward compatibility: handle single tenant_id update
        elif user_update.tenant_id is not None:
            # Ensure user has access to assign to this tenant
            validate_admin_tenant_assignment_permission(current_user, [user_update.tenant_id], db)
            
            # Update primary tenant assignment
            ensure_single_primary_tenant(user.id, user_update.tenant_id, db)
        
        db.commit()
        db.refresh(user)
        
        # Convert role object to role name
        role_name = None
        if hasattr(user, 'role') and user.role:
            role_name = user.role.name
        
        # Get tenant_id from tenant object
        tenant_id = None
        if hasattr(user, 'tenant') and user.tenant:
            tenant_id = user.tenant.tenant_id
        
        return UserResponse(
            id=user.user_id,
            user_id=user.user_id,
            username=user.username,
            full_name=user.full_name,
            email=user.email,
            is_active=user.is_active,
            role=user.role.name if user.role else None,
            tenant_id=user.get_primary_tenant_id(),  # Backward compatibility
            primary_tenant_id=user.get_primary_tenant_id(),
            tenant_assignments=[],  # Will be populated with actual assignments
            is_msp_user=user.is_msp_user,
            # SSO_FUTURE: SSO user information
            external_id=user.external_id,
            identity_provider=user.identity_provider,
            is_sso_user=user.is_sso_user
        )
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating user: {str(e)}"
        )


@router.delete("/{user_id}")
def delete_user(
    user_id: str,  # Changed from int to str to accept UUID
    tenant_id: Optional[str] = Query(None, description="Tenant ID context for the operation"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Delete a user with multi-tenant access control.
    
    SSO_FUTURE: Will handle SSO user deletion and external identity cleanup.
    """
    # Resolve tenant context for permission checking
    operation_tenant_id = resolve_tenant_context(current_user, tenant_id, db)
    
    # Check if user has permission to delete users in the tenant
    if not has_permission_in_tenant(current_user, "delete:users", operation_tenant_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to delete users in this tenant"
        )
    
    try:
        # Get the user by UUID (user_id field), not internal integer id
        user = db.query(User).filter(User.user_id == user_id).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found"
            )
        
        # Check if current user has access to delete this user
        if not current_user.is_msp_user:
            # Check if the target user has any tenant assignments that the current user can access
            current_user_accessible_tenants = set(get_user_accessible_tenant_ids(current_user, db))
            target_user_tenant_ids = set([assignment.tenant_id for assignment in user.get_tenant_assignments()])
            
            # If there's no overlap in accessible tenants, deny access
            if not current_user_accessible_tenants.intersection(target_user_tenant_ids):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to delete this user"
                )
        
        # Prevent self-deletion
        if user.user_id == current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete your own account"
            )
        
        # Delete user tenant assignments first (foreign key constraint)
        db.query(UserTenantAssignment).filter(
            UserTenantAssignment.user_id == user.id
        ).delete()
        
        # Delete the user
        db.delete(user)
        db.commit()
        
        return {"message": f"User {user_id} deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting user: {str(e)}"
        )


@router.get("/debug/list", include_in_schema=False)
def debug_list_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Debug endpoint to see raw user data
    """
    try:
        users = db.query(User).limit(10).all()
        result = []
        for user in users:
            result.append({
                "internal_id": user.id,
                "user_id": user.user_id,
                "user_id_type": type(user.user_id).__name__,
                "username": user.username,
                "tenant_id": user.tenant_id
            })
        return {"users": result, "count": len(result)}
    except Exception as e:
        return {"error": str(e)}

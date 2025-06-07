from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
import uuid

from app.api.endpoints.auth import get_current_user
from app.db.session import get_db
from app.models.user import User, Tenant, Role
from app.models.user_tenant_assignment import UserTenantAssignment
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.core.security import get_password_hash
from app.core.permissions import (
    has_permission_in_tenant, 
    get_user_accessible_tenants,
    has_global_permission
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
    if not has_permission_in_tenant(current_user, "view:users", target_tenant_id, db):
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
                    is_msp_user=user.is_msp_user
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get a specific user by UUID
    """
    # Check if user has permission to view users
    has_permission = any(p.name == "view:users" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Look up user by UUID (user_id field), not internal integer id
        user = db.query(User).filter(User.user_id == user_id).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found"
            )
        
        # Check if user has access to this user's tenant
        if user.tenant_id != current_user.tenant_id and current_user.role.name != "admin" and current_user.role.name != "msp":
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
            tenant_id=tenant_id
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
            # Create primary tenant assignment
            primary_assignment = UserTenantAssignment(
                user_id=new_user.id,  # Use integer primary key instead of UUID
                tenant_id=target_tenant_id,
                role_id=role.id,
                is_primary=True,
                is_active=True
            )
            db.add(primary_assignment)
            
            # Create additional tenant assignments if specified
            if user.additional_tenant_ids:
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Update a user
    """
    # Check if user has permission to update users
    has_permission = any(p.name == "update:users" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Get the user by UUID (user_id field), not internal integer id
        user = db.query(User).filter(User.user_id == user_id).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found"
            )
        
        # Check if user has access to this user's tenant
        if user.tenant_id != current_user.tenant_id and current_user.role.name != "admin" and current_user.role.name != "msp":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this user"
            )
        
        # Update user fields
        if user_update.username is not None:
            # Check if username already exists
            existing_user = db.query(User).filter(
                (User.username == user_update.username) & (User.user_id != user_id)
            ).first()
            
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Username already registered"
                )
            
            user.username = user_update.username
        
        if user_update.full_name is not None:
            user.full_name = user_update.full_name
        
        if user_update.email is not None:
            # Check if email already exists
            existing_user = db.query(User).filter(
                (User.email == user_update.email) & (User.user_id != user_id)
            ).first()
            
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered"
                )
            
            user.email = user_update.email
        
        if user_update.password is not None:
            user.hashed_password = get_password_hash(user_update.password)
        
        if user_update.is_active is not None:
            user.is_active = user_update.is_active
        
        if user_update.role is not None:
            # Get role
            role = db.query(Role).filter(Role.name == user_update.role).first()
            if not role:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Role '{user_update.role}' not found"
                )
            
            user.role_id = role.id
        
        if user_update.tenant_id is not None:
            # Handle different tenant ID formats
            try:
                tenant_id = user_update.tenant_id
                
                # Remove 'tenant-' prefix if present
                if tenant_id.startswith('tenant-'):
                    tenant_id = tenant_id[7:]
                
                # Try to parse as UUID
                try:
                    uuid_obj = uuid.UUID(tenant_id)
                    tenant = db.query(Tenant).filter(Tenant.tenant_id == str(uuid_obj)).first()
                except ValueError:
                    # Not a valid UUID, try to find by numeric ID
                    try:
                        id_value = int(tenant_id)
                        tenant = db.query(Tenant).filter(Tenant.id == id_value).first()
                    except (ValueError, TypeError):
                        tenant = None
                
                if not tenant:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Tenant with ID {tenant_id} not found"
                    )
                
                # Check if user has access to this tenant
                if tenant.tenant_id != current_user.tenant_id and current_user.role.name != "admin" and current_user.role.name != "msp":
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Not authorized to assign users to this tenant"
                    )
                
                user.tenant_id = tenant.tenant_id
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid tenant ID format: {str(e)}"
                )
        
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
            id=user.user_id,  # Use UUID as id, not internal integer
            user_id=user.user_id,
            username=user.username,
            full_name=user.full_name,
            email=user.email,
            is_active=user.is_active,
            role=role_name,
            tenant_id=tenant_id
        )
    
    except HTTPException:
        db.rollback()
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Delete a user
    """
    # Check if user has permission to delete users
    has_permission = any(p.name == "delete:users" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Get the user by UUID (user_id field), not internal integer id
        user = db.query(User).filter(User.user_id == user_id).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {user_id} not found"
            )
        
        # Check if user has access to this user's tenant
        if user.tenant_id != current_user.tenant_id and current_user.role.name != "admin" and current_user.role.name != "msp":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to delete this user"
            )
        
        # Prevent deleting yourself
        if user.user_id == current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete your own user account"
            )
        
        # Handle related records before deleting the user
        # Import Dashboard model here to avoid circular imports
        from app.models.dashboard import Dashboard
        from app.models.user_tenant_assignment import UserTenantAssignment
        
        # Delete user's dashboards first (since they have NOT NULL constraint)
        user_dashboards = db.query(Dashboard).filter(Dashboard.user_id == user.user_id).all()
        for dashboard in user_dashboards:
            db.delete(dashboard)
        
        # Delete user's tenant assignments to avoid foreign key constraint violations
        user_assignments = db.query(UserTenantAssignment).filter(UserTenantAssignment.user_id == user.id).all()
        for assignment in user_assignments:
            db.delete(assignment)
        
        # For other tables with nullable foreign keys, we could set them to NULL
        # but since they're already nullable=True, SQLAlchemy should handle this automatically
        
        # Delete user
        db.delete(user)
        db.commit()
        
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    
    except HTTPException:
        db.rollback()
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

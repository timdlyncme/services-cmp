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
    has_permission = any(p.name == "list:users" for p in current_user.role.permissions)
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
    # Determine target tenant assignments
    tenant_assignments = []
    
    # Handle new multi-tenant assignments
    if user.tenant_assignments:
        tenant_assignments = user.tenant_assignments
    elif tenant_id or user.tenant_id:
        # Backward compatibility: single tenant assignment
        target_tenant_id = tenant_id or user.tenant_id
        tenant_assignments = [{"tenant_id": target_tenant_id, "role": user.role, "is_primary": True}]
    elif not user.is_msp_user:
        # Default to current user's primary tenant for regular users
        primary_assignment = current_user.get_primary_tenant_assignment()
        if primary_assignment:
            tenant_assignments = [{"tenant_id": primary_assignment.tenant_id, "role": user.role, "is_primary": True}]

    # Check permissions for each tenant assignment
    if user.is_msp_user:
        # Creating MSP user requires global permission
        if not has_global_permission(current_user, "create:msp-users"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions to create MSP users"
            )
    else:
        # Creating regular user requires tenant permission for each assignment
        if not tenant_assignments:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Tenant assignments required for non-MSP users"
            )
        
        for assignment in tenant_assignments:
            if not has_permission_in_tenant(current_user, "create:users", assignment["tenant_id"], db):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Not enough permissions to create users in tenant {assignment['tenant_id']}"
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
        
        # Get role for MSP users (regular users get roles per tenant)
        role = None
        if user.is_msp_user:
            role = db.query(Role).filter(Role.name == user.role).first()
            if not role:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Role '{user.role}' not found"
                )
            
            # Validate role assignment
            if role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="MSP users must have MSP role"
                )

        # Create new user
        new_user = User(
            username=user.username,
            full_name=user.full_name,
            email=user.email,
            hashed_password=get_password_hash(user.password),
            role_id=role.id if role else None,
            is_active=user.is_active,
            is_msp_user=user.is_msp_user,
            user_id=str(uuid.uuid4())
        )
        
        # Set legacy tenant_id for backward compatibility (primary tenant)
        primary_assignment = next((a for a in tenant_assignments if a.get("is_primary")), None)
        if not primary_assignment and tenant_assignments:
            primary_assignment = tenant_assignments[0]
            primary_assignment["is_primary"] = True
        
        if primary_assignment:
            new_user.tenant_id = primary_assignment["tenant_id"]
        
        db.add(new_user)
        db.flush()  # Get the user ID
        
        # Create tenant assignments for non-MSP users
        if not user.is_msp_user:
            for assignment in tenant_assignments:
                # Get role for this assignment
                assignment_role = db.query(Role).filter(Role.name == assignment["role"]).first()
                if not assignment_role:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Role '{assignment['role']}' not found"
                    )
                
                # Validate role assignment
                if assignment_role.name == "msp":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Non-MSP users cannot have MSP role"
                    )
                
                # Create tenant assignment
                tenant_assignment = UserTenantAssignment(
                    user_id=new_user.id,
                    tenant_id=assignment["tenant_id"],
                    role_id=assignment_role.id,
                    is_primary=assignment.get("is_primary", False),
                    is_active=True
                )
                db.add(tenant_assignment)
        
        db.commit()
        db.refresh(new_user)
        
        # Build response with tenant assignments
        response_assignments = []
        if not user.is_msp_user:
            for assignment in new_user.get_tenant_assignments():
                response_assignments.append({
                    "tenant_id": assignment.tenant_id,
                    "role": assignment.role.name if assignment.role else None,
                    "is_primary": assignment.is_primary
                })
        
        return UserResponse(
            id=new_user.user_id,
            user_id=new_user.user_id,
            username=new_user.username,
            full_name=new_user.full_name,
            email=new_user.email,
            is_active=new_user.is_active,
            role=role.name if role else (primary_assignment["role"] if primary_assignment else None),
            tenant_id=primary_assignment["tenant_id"] if primary_assignment else "msp",
            tenant_assignments=response_assignments,
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
    Update a user with multi-tenant assignment support
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
        
        # Update basic user fields
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
        
        # Handle role updates for MSP users
        if user_update.role is not None and user.is_msp_user:
            # Get role
            role = db.query(Role).filter(Role.name == user_update.role).first()
            if not role:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Role '{user_update.role}' not found"
                )
            
            user.role_id = role.id
        
        # Handle tenant assignments update
        if user_update.tenant_assignments is not None and not user.is_msp_user:
            # Validate permissions for each new tenant assignment
            for assignment in user_update.tenant_assignments:
                if not has_permission_in_tenant(current_user, "create:users", assignment.tenant_id, db):
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Not enough permissions to assign users to tenant {assignment.tenant_id}"
                    )
            
            # Remove existing tenant assignments
            db.query(UserTenantAssignment).filter(
                UserTenantAssignment.user_id == user.id
            ).delete()
            
            # Create new tenant assignments
            primary_assignment = None
            for assignment in user_update.tenant_assignments:
                # Get role for this assignment
                assignment_role = db.query(Role).filter(Role.name == assignment.role).first()
                if not assignment_role:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Role '{assignment.role}' not found"
                    )
                
                # Validate role assignment
                if assignment_role.name == "msp":
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Non-MSP users cannot have MSP role"
                    )
                
                # Create tenant assignment
                tenant_assignment = UserTenantAssignment(
                    user_id=user.id,
                    tenant_id=assignment.tenant_id,
                    role_id=assignment_role.id,
                    is_primary=assignment.is_primary,
                    is_active=True
                )
                db.add(tenant_assignment)
                
                # Track primary assignment for legacy tenant_id update
                if assignment.is_primary:
                    primary_assignment = assignment
            
            # Ensure at least one assignment is primary
            if not primary_assignment and user_update.tenant_assignments:
                primary_assignment = user_update.tenant_assignments[0]
                # Update the first assignment to be primary
                first_assignment = db.query(UserTenantAssignment).filter(
                    UserTenantAssignment.user_id == user.id,
                    UserTenantAssignment.tenant_id == primary_assignment.tenant_id
                ).first()
                if first_assignment:
                    first_assignment.is_primary = True
            
            # Update legacy tenant_id field
            if primary_assignment:
                user.tenant_id = primary_assignment.tenant_id
        
        # Handle legacy single tenant update for backward compatibility
        elif user_update.tenant_id is not None:
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
                
                # Update primary tenant assignment if it exists
                primary_assignment = db.query(UserTenantAssignment).filter(
                    UserTenantAssignment.user_id == user.id,
                    UserTenantAssignment.is_primary == True
                ).first()
                
                if primary_assignment:
                    primary_assignment.tenant_id = tenant.tenant_id
                
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid tenant ID format: {str(e)}"
                )
        
        db.commit()
        db.refresh(user)
        
        # Build response with tenant assignments
        response_assignments = []
        if not user.is_msp_user:
            for assignment in user.get_tenant_assignments():
                response_assignments.append({
                    "tenant_id": assignment.tenant_id,
                    "role": assignment.role.name if assignment.role else None,
                    "is_primary": assignment.is_primary
                })
        
        # Convert role object to role name
        role_name = None
        if hasattr(user, 'role') and user.role:
            role_name = user.role.name
        elif response_assignments:
            # For non-MSP users, get role from primary assignment
            primary = next((a for a in response_assignments if a["is_primary"]), None)
            role_name = primary["role"] if primary else None
        
        # Get tenant_id from tenant object
        tenant_id = None
        if hasattr(user, 'tenant') and user.tenant:
            tenant_id = user.tenant.tenant_id
        elif user.tenant_id:
            tenant_id = user.tenant_id
        
        return UserResponse(
            id=user.user_id,  # Use UUID as id, not internal integer
            user_id=user.user_id,
            username=user.username,
            full_name=user.full_name,
            email=user.email,
            is_active=user.is_active,
            role=role_name,
            tenant_id=tenant_id,
            tenant_assignments=response_assignments,
            is_msp_user=user.is_msp_user
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
        
        # Delete user's dashboards first (since they have NOT NULL constraint)
        user_dashboards = db.query(Dashboard).filter(Dashboard.user_id == user.user_id).all()
        for dashboard in user_dashboards:
            db.delete(dashboard)
        
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

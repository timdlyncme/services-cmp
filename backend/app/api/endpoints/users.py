from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
import uuid

from app.api.endpoints.auth import get_current_user
from app.db.session import get_db
from app.models.user import User, Tenant, Role
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.core.security import get_password_hash

router = APIRouter()


@router.get("/", response_model=List[UserResponse])
def get_users(
    tenant_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get all users for the current user's tenant or a specific tenant
    """
    # Check if user has permission to view users
    has_permission = any(p.name == "view:users" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        query = db.query(User)
        
        # Filter by tenant
        if tenant_id:
            # Handle different tenant ID formats
            try:
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
                if tenant.id != current_user.tenant_id and current_user.role.name != "admin" and current_user.role.name != "msp":
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Not authorized to view users for this tenant"
                    )
                
                query = query.filter(User.tenant_id == tenant.id)
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid tenant ID format: {str(e)}"
                )
        else:
            # Default to current user's tenant
            # MSP users can see all users
            if current_user.role.name != "msp":
                query = query.filter(User.tenant_id == current_user.tenant_id)
        
        users = query.all()
        
        # Convert tenant_id to UUID string in response
        for user in users:
            if hasattr(user, 'tenant') and user.tenant:
                user.tenant_id = user.tenant.tenant_id
        
        return users
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving users: {str(e)}"
        )


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get a specific user by ID
    """
    # Check if user has permission to view users
    has_permission = any(p.name == "view:users" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        user = db.query(User).filter(User.id == user_id).first()
        
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
        
        # Set tenant_id to UUID string in response
        if hasattr(user, 'tenant') and user.tenant:
            user.tenant_id = user.tenant.tenant_id
        
        return user
    
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
    Create a new user
    """
    # Check if user has permission to create users
    has_permission = any(p.name == "create:users" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
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
        
        # Determine which tenant to use
        target_tenant_id = current_user.tenant_id
        
        # If tenant_id is provided, use that instead
        if tenant_id:
            # Handle different tenant ID formats
            try:
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
                if tenant.id != current_user.tenant_id and current_user.role.name != "admin" and current_user.role.name != "msp":
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Not authorized to create users for this tenant"
                    )
                
                target_tenant_id = tenant.id
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid tenant ID format: {str(e)}"
                )
        
        # Get role
        role = db.query(Role).filter(Role.name == user.role).first()
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Role '{user.role}' not found"
            )
        
        # Create new user
        new_user = User(
            user_id=str(uuid.uuid4()),
            username=user.username,
            full_name=user.full_name,
            email=user.email,
            hashed_password=get_password_hash(user.password),
            is_active=True,
            role_id=role.id,
            tenant_id=target_tenant_id
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        # Set tenant_id to UUID string in response
        if hasattr(new_user, 'tenant') and new_user.tenant:
            new_user.tenant_id = new_user.tenant.tenant_id
        
        return new_user
    
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
    user_id: int,
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
        # Get the user
        user = db.query(User).filter(User.id == user_id).first()
        
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
                (User.username == user_update.username) & (User.id != user_id)
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
                (User.email == user_update.email) & (User.id != user_id)
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
                if tenant.id != current_user.tenant_id and current_user.role.name != "admin" and current_user.role.name != "msp":
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Not authorized to assign users to this tenant"
                    )
                
                user.tenant_id = tenant.id
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid tenant ID format: {str(e)}"
                )
        
        db.commit()
        db.refresh(user)
        
        # Set tenant_id to UUID string in response
        if hasattr(user, 'tenant') and user.tenant:
            user.tenant_id = user.tenant.tenant_id
        
        return user
    
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
    user_id: int,
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
        # Get the user
        user = db.query(User).filter(User.id == user_id).first()
        
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
        if user.id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete your own user account"
            )
        
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

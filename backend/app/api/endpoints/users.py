from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Query
from sqlalchemy.orm import Session

from app.api.endpoints.auth import get_current_user
from app.db.session import get_db
from app.models.user import User, Tenant, Role
from app.schemas.user import UserResponse, UserCreate, UserUpdate

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
    # Add CORS headers
    response = Response()
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    
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
            tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
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
        else:
            # Default to current user's tenant
            query = query.filter(User.tenant_id == current_user.tenant_id)
        
        users = query.all()
        
        return [
            UserResponse(
                id=user.id,
                email=user.email,
                username=user.username,
                full_name=user.full_name,
                is_active=user.is_active,
                role=user.role.name,
                tenant_id=user.tenant_id
            )
            for user in users
        ]
    
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
        if user.tenant_id != current_user.tenant_id:
            # Admin users can view all users
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to access this user"
                )
        
        return UserResponse(
            id=user.id,
            email=user.email,
            username=user.username,
            full_name=user.full_name,
            is_active=user.is_active,
            role=user.role.name,
            tenant_id=user.tenant_id
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
        # Check if email already exists
        existing_user = db.query(User).filter(User.email == user.email).first()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        
        # Determine which tenant to use
        target_tenant_id = current_user.tenant_id
        
        # If tenant_id is provided, use that instead
        if tenant_id:
            # Check if tenant exists
            tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
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
        
        # Get the role
        role = db.query(Role).filter(Role.name == user.role).first()
        if not role:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Role {user.role} not found"
            )
        
        # Create new user
        from app.core.security import get_password_hash
        new_user = User(
            email=user.email,
            username=user.username,
            full_name=user.full_name,
            hashed_password=get_password_hash(user.password),
            is_active=True,
            role_id=role.id,
            tenant_id=target_tenant_id
        )
        
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        return UserResponse(
            id=new_user.id,
            email=new_user.email,
            username=new_user.username,
            full_name=new_user.full_name,
            is_active=new_user.is_active,
            role=new_user.role.name,
            tenant_id=new_user.tenant_id
        )
    
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
        if user.tenant_id != current_user.tenant_id:
            # Admin users can update all users
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to update this user"
                )
        
        # Update user
        if user_update.email is not None:
            # Check if email already exists
            existing_user = db.query(User).filter(User.email == user_update.email).first()
            if existing_user and existing_user.id != user_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already registered"
                )
            user.email = user_update.email
        
        if user_update.username is not None:
            user.username = user_update.username
        
        if user_update.full_name is not None:
            user.full_name = user_update.full_name
        
        if user_update.password is not None:
            from app.core.security import get_password_hash
            user.hashed_password = get_password_hash(user_update.password)
        
        if user_update.is_active is not None:
            user.is_active = user_update.is_active
        
        if user_update.role is not None:
            # Get the role
            role = db.query(Role).filter(Role.name == user_update.role).first()
            if not role:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Role {user_update.role} not found"
                )
            user.role_id = role.id
        
        db.commit()
        db.refresh(user)
        
        return UserResponse(
            id=user.id,
            email=user.email,
            username=user.username,
            full_name=user.full_name,
            is_active=user.is_active,
            role=user.role.name,
            tenant_id=user.tenant_id
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
        if user.tenant_id != current_user.tenant_id:
            # Admin users can delete all users
            if current_user.role.name != "admin" and current_user.role.name != "msp":
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


@router.options("/")
def options_users():
    """
    Handle preflight requests for users
    """
    response = Response(status_code=200)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response


@router.options("/{user_id}")
def options_user_by_id():
    """
    Handle preflight requests for specific user
    """
    response = Response(status_code=200)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response


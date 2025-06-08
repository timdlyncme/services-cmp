"""
MSP (Managed Service Provider) specific endpoints.

These endpoints are only accessible to MSP users and provide
global management capabilities across all tenants.
"""

from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import uuid

from app.api.endpoints.auth import get_current_user
from app.db.session import get_db
from app.models.user import User, Tenant, Role
from app.models.user_tenant_assignment import UserTenantAssignment
from app.schemas.user import UserCreate, UserUpdate, UserResponse
from app.core.security import get_password_hash
from app.core.permissions import has_global_permission

router = APIRouter()


@router.get("/users", response_model=List[UserResponse])
def get_msp_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get all MSP users. Only accessible to MSP users.
    """
    # Check if user is MSP and has permission
    if not current_user.is_msp_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only MSP users can access this endpoint"
        )
    
    if not has_global_permission(current_user, "list:msp-users"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to view MSP users"
        )
    
    try:
        # Get all MSP users
        msp_users = db.query(User).filter(User.is_msp_user == True).all()
        
        result = []
        for user in msp_users:
            result.append(
                UserResponse(
                    id=user.user_id,
                    user_id=user.user_id,
                    username=user.username,
                    full_name=user.full_name,
                    email=user.email,
                    is_active=user.is_active,
                    role=user.role.name if user.role else None,
                    tenant_id="msp",  # MSP users don't belong to specific tenants
                    is_msp_user=True
                )
            )
        
        return result
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving MSP users: {str(e)}"
        )


@router.post("/users", response_model=UserResponse)
def create_msp_user(
    user: UserCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Create a new MSP user. Only accessible to MSP users.
    """
    # Check if user is MSP and has permission
    if not current_user.is_msp_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only MSP users can access this endpoint"
        )
    
    if not has_global_permission(current_user, "create:msp-users"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to create MSP users"
        )
    
    try:
        # Force MSP user creation
        user.is_msp_user = True
        user.role = "msp"  # Force MSP role
        
        # Check if username or email already exists
        existing_user = db.query(User).filter(
            (User.username == user.username) | (User.email == user.email)
        ).first()
        
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username or email already registered"
            )
        
        # Get MSP role
        msp_role = db.query(Role).filter(Role.name == "msp").first()
        if not msp_role:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="MSP role not found in database"
            )
        
        # Create new MSP user
        new_user = User(
            username=user.username,
            full_name=user.full_name,
            email=user.email,
            hashed_password=get_password_hash(user.password),
            role_id=msp_role.id,
            is_active=user.is_active,
            is_msp_user=True,
            user_id=str(uuid.uuid4())
        )
        
        db.add(new_user)
        db.flush()  # Get the user ID
        
        # Create tenant assignments for all tenants
        all_tenants = db.query(Tenant).filter(Tenant.is_active == True).all()
        for i, tenant in enumerate(all_tenants):
            msp_assignment = UserTenantAssignment(
                user_id=new_user.user_id,
                tenant_id=tenant.tenant_id,
                role_id=msp_role.id,
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
            role="msp",
            tenant_id="msp",
            is_msp_user=True
        )
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating MSP user: {str(e)}"
        )


@router.put("/users/{user_id}", response_model=UserResponse)
def update_msp_user(
    user_id: str,
    user_update: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Update an MSP user. Only accessible to MSP users.
    """
    # Check if user is MSP and has permission
    if not current_user.is_msp_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only MSP users can access this endpoint"
        )
    
    if not has_global_permission(current_user, "update:msp-users"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to update MSP users"
        )
    
    try:
        # Get the MSP user
        user = db.query(User).filter(
            User.user_id == user_id,
            User.is_msp_user == True
        ).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"MSP user with ID {user_id} not found"
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
        
        # Prevent changing MSP user to non-MSP
        if user_update.is_msp_user is not None and not user_update.is_msp_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot change MSP user to non-MSP user"
            )
        
        # Prevent changing role from MSP
        if user_update.role is not None and user_update.role != "msp":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="MSP users must have MSP role"
            )
        
        db.commit()
        db.refresh(user)
        
        return UserResponse(
            id=user.user_id,
            user_id=user.user_id,
            username=user.username,
            full_name=user.full_name,
            email=user.email,
            is_active=user.is_active,
            role="msp",
            tenant_id="msp",
            is_msp_user=True
        )
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating MSP user: {str(e)}"
        )


@router.delete("/users/{user_id}")
def delete_msp_user(
    user_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Delete an MSP user. Only accessible to MSP users.
    """
    # Check if user is MSP and has permission
    if not current_user.is_msp_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only MSP users can access this endpoint"
        )
    
    if not has_global_permission(current_user, "delete:msp-users"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to delete MSP users"
        )
    
    try:
        # Get the MSP user
        user = db.query(User).filter(
            User.user_id == user_id,
            User.is_msp_user == True
        ).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"MSP user with ID {user_id} not found"
            )
        
        # Prevent deleting yourself
        if user.user_id == current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete your own MSP user account"
            )
        
        # Delete user tenant assignments first
        db.query(UserTenantAssignment).filter(
            UserTenantAssignment.user_id == user.user_id
        ).delete()
        
        # Handle related records before deleting the user
        from app.models.dashboard import Dashboard
        
        # Delete user's dashboards first
        user_dashboards = db.query(Dashboard).filter(Dashboard.user_id == user.user_id).all()
        for dashboard in user_dashboards:
            db.delete(dashboard)
        
        # Delete user
        db.delete(user)
        db.commit()
        
        return {"message": "MSP user deleted successfully"}
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting MSP user: {str(e)}"
        )


@router.get("/tenants", response_model=List[dict])
def get_all_tenants(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get all tenants with user counts. Only accessible to MSP users.
    """
    # Check if user is MSP and has permission
    if not current_user.is_msp_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only MSP users can access this endpoint"
        )
    
    if not has_global_permission(current_user, "list:all-tenants"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to view all tenants"
        )
    
    try:
        tenants = db.query(Tenant).filter(Tenant.is_active == True).all()
        
        result = []
        for tenant in tenants:
            # Count users in this tenant (excluding MSP users)
            user_count = db.query(UserTenantAssignment).filter(
                UserTenantAssignment.tenant_id == tenant.tenant_id,
                UserTenantAssignment.is_active == True
            ).join(User).filter(User.is_msp_user == False).count()
            
            result.append({
                "id": tenant.tenant_id,
                "name": tenant.name,
                "description": tenant.description,
                "is_active": tenant.is_active,
                "user_count": user_count,
                "date_created": tenant.date_created.isoformat() if tenant.date_created else None,
                "date_modified": tenant.date_modified.isoformat() if tenant.date_modified else None
            })
        
        return result
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving tenants: {str(e)}"
        )


@router.get("/analytics/platform", response_model=dict)
def get_platform_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get platform-wide analytics. Only accessible to MSP users.
    """
    # Check if user is MSP and has permission
    if not current_user.is_msp_user:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only MSP users can access this endpoint"
        )
    
    if not has_global_permission(current_user, "list:platform-analytics"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to view platform analytics"
        )
    
    try:
        # Get basic counts
        total_tenants = db.query(Tenant).filter(Tenant.is_active == True).count()
        total_users = db.query(User).filter(User.is_msp_user == False).count()
        total_msp_users = db.query(User).filter(User.is_msp_user == True).count()
        
        # Get user distribution by role
        role_distribution = {}
        roles = db.query(Role).all()
        for role in roles:
            count = db.query(User).filter(
                User.role_id == role.id,
                User.is_msp_user == False
            ).count()
            role_distribution[role.name] = count
        
        # Get tenant user counts
        tenant_stats = []
        tenants = db.query(Tenant).filter(Tenant.is_active == True).all()
        for tenant in tenants:
            user_count = db.query(UserTenantAssignment).filter(
                UserTenantAssignment.tenant_id == tenant.tenant_id,
                UserTenantAssignment.is_active == True
            ).join(User).filter(User.is_msp_user == False).count()
            
            tenant_stats.append({
                "tenant_id": tenant.tenant_id,
                "tenant_name": tenant.name,
                "user_count": user_count
            })
        
        return {
            "total_tenants": total_tenants,
            "total_users": total_users,
            "total_msp_users": total_msp_users,
            "role_distribution": role_distribution,
            "tenant_stats": tenant_stats
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving platform analytics: {str(e)}"
        )


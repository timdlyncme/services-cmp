from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session

from app.api.endpoints.auth import get_current_user
from app.db.session import get_db
from app.models.user import Permission, User, Role
from app.schemas.permission import PermissionResponse, PermissionCreate

router = APIRouter()


@router.get("/", response_model=List[PermissionResponse])
def get_permissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get all permissions
    """
    # Add CORS headers
    response = Response()
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    
    # Check if user has permission to view permissions
    has_permission = any(p.name == "view:permissions" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        permissions = db.query(Permission).all()
        return [
            PermissionResponse(
                id=permission.id,
                name=permission.name,
                description=permission.description
            ) for permission in permissions
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving permissions: {str(e)}"
        )


@router.post("/", response_model=PermissionResponse)
def create_permission(
    permission_data: PermissionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Create a new permission with role assignment
    """
    # Check if user has permission to create permissions
    has_permission = any(p.name == "create:permissions" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Check if permission already exists
        existing_permission = db.query(Permission).filter(Permission.name == permission_data.name).first()
        if existing_permission:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Permission with name '{permission_data.name}' already exists"
            )
        
        # Validate that all specified roles exist in the database
        roles_to_assign = []
        for role_name in permission_data.roles:
            role = db.query(Role).filter(Role.name == role_name).first()
            if not role:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Role '{role_name}' does not exist"
                )
            roles_to_assign.append(role)
        
        # Create new permission
        new_permission = Permission(
            name=permission_data.name,
            description=permission_data.description
        )
        
        # Assign the permission to the specified roles
        new_permission.roles = roles_to_assign
        
        db.add(new_permission)
        db.commit()
        db.refresh(new_permission)
        
        return PermissionResponse(
            id=new_permission.id,
            name=new_permission.name,
            description=new_permission.description
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating permission: {str(e)}"
        )


@router.options("/")
def options_permissions():
    """
    Handle preflight requests for permissions
    """
    response = Response(status_code=200)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response


from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session

from app.api.endpoints.auth import get_current_user
from app.db.session import get_db
from app.models.user import Permission, User
from app.schemas.permission import PermissionResponse

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


@router.options("/")
def options_permissions():
    """
    Handle preflight requests for permissions
    """
    response = Response(status_code=200)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.endpoints.auth import get_current_user
from app.db.session import get_db
from app.models.user import User, Permission, Role
from app.schemas.user import Permission as PermissionSchema

router = APIRouter()


@router.get("/", response_model=List[PermissionSchema])
def get_permissions(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Any:
    """
    Get all permissions for the current user
    """
    # Get role permissions
    role_permissions = db.query(Permission).join(
        Role.permissions
    ).filter(Role.id == current_user.role_id).all()
    
    # Get user permissions
    user_permissions = db.query(Permission).join(
        User.permissions
    ).filter(User.id == current_user.id).all()
    
    # Combine permissions
    all_permissions = list(set(role_permissions + user_permissions))
    
    return [
        {
            "id": permission.id,
            "name": permission.name,
            "description": permission.description
        }
        for permission in all_permissions
    ]


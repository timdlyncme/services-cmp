from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.endpoints.auth import get_current_user
from app.db.session import get_db
from app.models.user import User, Permission
from app.schemas.user import Permission as PermissionSchema

router = APIRouter()


@router.get("/", response_model=List[PermissionSchema])
def get_permissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Get all permissions
    """
    permissions = db.query(Permission).all()
    return permissions


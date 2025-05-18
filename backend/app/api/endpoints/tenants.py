from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.endpoints.auth import get_current_user
from app.db.session import get_db
from app.models.user import Tenant, User
from app.schemas.tenant import TenantResponse

router = APIRouter()


@router.get("/", response_model=List[TenantResponse])
def get_tenants(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get all tenants
    """
    # Check if user has permission to view tenants
    has_permission = any(p.name == "view:tenants" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        tenants = db.query(Tenant).all()
        return [
            TenantResponse(
                id=tenant.id,
                tenant_id=tenant.tenant_id,
                name=tenant.name,
                description=tenant.description
            ) for tenant in tenants
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving tenants: {str(e)}"
        )

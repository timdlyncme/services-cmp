from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.endpoints.auth import get_current_user
from app.db.session import get_db
from app.models.user import User, Tenant, Role
from app.schemas.user import Tenant as TenantSchema

router = APIRouter()


@router.get("/", response_model=List[TenantSchema])
def get_tenants(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> Any:
    """
    Get all tenants accessible to the current user
    """
    # Check if user is MSP (can see all tenants)
    is_msp = db.query(Role).filter(Role.id == current_user.role_id, Role.name == "msp").first() is not None
    
    if is_msp:
        # MSP users can see all tenants
        tenants = db.query(Tenant).all()
    else:
        # Regular users can only see their own tenant
        tenants = [current_user.tenant]
    
    return [
        {
            "id": tenant.tenant_id,
            "tenant_id": tenant.tenant_id,
            "name": tenant.name,
            "description": tenant.description,
            "created_at": tenant.created_at
        }
        for tenant in tenants
    ]


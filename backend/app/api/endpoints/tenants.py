from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status, Response
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
    # Add CORS headers
    response = Response()
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    
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


@router.options("/")
def options_tenants():
    """
    Handle preflight requests for tenants
    """
    response = Response(status_code=200)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

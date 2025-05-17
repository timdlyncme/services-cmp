from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.endpoints.auth import get_current_user
from app.db.session import get_db
from app.models.user import User, Tenant
from app.schemas.user import Tenant as TenantSchema

router = APIRouter()


@router.get("/", response_model=List[TenantSchema])
def get_tenants(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Any:
    """
    Get all tenants
    """
    tenants = db.query(Tenant).all()
    return tenants


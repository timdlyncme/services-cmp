from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import logging

from app.api.deps import get_current_user, get_db
from app.core.security import get_password_hash
from app.models.user import User
from app.models.service_account import ServiceAccount
from app.schemas.service_account import (
    ServiceAccountCreate,
    ServiceAccountUpdate,
    ServiceAccountResponse
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("service_accounts")

router = APIRouter()


@router.post("/", response_model=ServiceAccountResponse)
def create_service_account(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    service_account_in: ServiceAccountCreate
):
    """
    Create a new service account
    """
    # Check if user has permission to create service accounts
    if not current_user.role or "admin:system" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Check if username already exists
    existing_account = db.query(ServiceAccount).filter(
        ServiceAccount.username == service_account_in.username
    ).first()
    
    if existing_account:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    # Create new service account
    service_account = ServiceAccount(
        name=service_account_in.name,
        description=service_account_in.description,
        username=service_account_in.username,
        hashed_password=get_password_hash(service_account_in.password),
        scope=service_account_in.scope,
        tenant_id=service_account_in.tenant_id,
        role_id=service_account_in.role_id
    )
    
    db.add(service_account)
    db.commit()
    db.refresh(service_account)
    
    # Prepare response
    response = ServiceAccountResponse(
        id=service_account.id,
        service_account_id=service_account.service_account_id,
        name=service_account.name,
        description=service_account.description,
        username=service_account.username,
        scope=service_account.scope,
        is_active=service_account.is_active,
        created_at=service_account.created_at,
        updated_at=service_account.updated_at,
        tenant_id=service_account.tenant_id,
        role_id=service_account.role_id,
        tenant_name=service_account.tenant.name if service_account.tenant else None,
        role_name=service_account.role.name if service_account.role else None
    )
    
    return response


@router.get("/", response_model=List[ServiceAccountResponse])
def list_service_accounts(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100
):
    """
    List service accounts
    """
    # Check if user has permission to list service accounts
    if not current_user.role or "admin:system" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Get service accounts
    service_accounts = db.query(ServiceAccount).offset(skip).limit(limit).all()
    
    # Prepare response
    response = []
    for account in service_accounts:
        response.append(
            ServiceAccountResponse(
                id=account.id,
                service_account_id=account.service_account_id,
                name=account.name,
                description=account.description,
                username=account.username,
                scope=account.scope,
                is_active=account.is_active,
                created_at=account.created_at,
                updated_at=account.updated_at,
                tenant_id=account.tenant_id,
                role_id=account.role_id,
                tenant_name=account.tenant.name if account.tenant else None,
                role_name=account.role.name if account.role else None
            )
        )
    
    return response


@router.get("/{service_account_id}", response_model=ServiceAccountResponse)
def get_service_account(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    service_account_id: str
):
    """
    Get a specific service account
    """
    # Check if user has permission to view service accounts
    if not current_user.role or "admin:system" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Get service account
    service_account = db.query(ServiceAccount).filter(
        ServiceAccount.service_account_id == service_account_id
    ).first()
    
    if not service_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service account not found"
        )
    
    # Prepare response
    response = ServiceAccountResponse(
        id=service_account.id,
        service_account_id=service_account.service_account_id,
        name=service_account.name,
        description=service_account.description,
        username=service_account.username,
        scope=service_account.scope,
        is_active=service_account.is_active,
        created_at=service_account.created_at,
        updated_at=service_account.updated_at,
        tenant_id=service_account.tenant_id,
        role_id=service_account.role_id,
        tenant_name=service_account.tenant.name if service_account.tenant else None,
        role_name=service_account.role.name if service_account.role else None
    )
    
    return response


@router.put("/{service_account_id}", response_model=ServiceAccountResponse)
def update_service_account(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    service_account_id: str,
    service_account_in: ServiceAccountUpdate
):
    """
    Update a service account
    """
    # Check if user has permission to update service accounts
    if not current_user.role or "admin:system" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Get service account
    service_account = db.query(ServiceAccount).filter(
        ServiceAccount.service_account_id == service_account_id
    ).first()
    
    if not service_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service account not found"
        )
    
    # Update service account
    update_data = service_account_in.dict(exclude_unset=True)
    
    # Hash password if provided
    if "password" in update_data:
        update_data["hashed_password"] = get_password_hash(update_data.pop("password"))
    
    for field, value in update_data.items():
        setattr(service_account, field, value)
    
    db.commit()
    db.refresh(service_account)
    
    # Prepare response
    response = ServiceAccountResponse(
        id=service_account.id,
        service_account_id=service_account.service_account_id,
        name=service_account.name,
        description=service_account.description,
        username=service_account.username,
        scope=service_account.scope,
        is_active=service_account.is_active,
        created_at=service_account.created_at,
        updated_at=service_account.updated_at,
        tenant_id=service_account.tenant_id,
        role_id=service_account.role_id,
        tenant_name=service_account.tenant.name if service_account.tenant else None,
        role_name=service_account.role.name if service_account.role else None
    )
    
    return response


@router.delete("/{service_account_id}", response_model=dict)
def delete_service_account(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    service_account_id: str
):
    """
    Delete a service account
    """
    # Check if user has permission to delete service accounts
    if not current_user.role or "admin:system" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Get service account
    service_account = db.query(ServiceAccount).filter(
        ServiceAccount.service_account_id == service_account_id
    ).first()
    
    if not service_account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Service account not found"
        )
    
    # Delete service account
    db.delete(service_account)
    db.commit()
    
    return {"message": "Service account deleted successfully"}


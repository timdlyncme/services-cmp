from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Query
from sqlalchemy.orm import Session

from app.api.endpoints.auth import get_current_user
from app.db.session import get_db
from app.models.user import User, Tenant
from app.models.deployment import CloudAccount
from app.schemas.deployment import (
    CloudAccountResponse, CloudAccountCreate, CloudAccountUpdate,
    CloudAccountFrontendResponse
)

router = APIRouter()


@router.get("/", response_model=List[CloudAccountFrontendResponse])
def get_cloud_accounts(
    tenant_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get all cloud accounts for the current user's tenant or a specific tenant
    """
    # Add CORS headers
    response = Response()
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    
    # Check if user has permission to view cloud accounts
    has_permission = any(p.name == "view:cloud-accounts" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        query = db.query(CloudAccount)
        
        # Filter by tenant
        if tenant_id:
            tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
            if not tenant:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Tenant with ID {tenant_id} not found"
                )
            query = query.filter(CloudAccount.tenant_id == tenant.id)
        else:
            # Default to current user's tenant
            query = query.filter(CloudAccount.tenant_id == current_user.tenant_id)
        
        cloud_accounts = query.all()
        
        # Convert to frontend-compatible format
        return [
            CloudAccountFrontendResponse(
                id=account.account_id,
                name=account.name,
                provider=account.provider,
                status=account.status,
                tenantId=current_user.tenant.tenant_id,
                connectionDetails={}  # Would need to add a connection_details field
            )
            for account in cloud_accounts
        ]
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving cloud accounts: {str(e)}"
        )


@router.get("/{account_id}", response_model=CloudAccountFrontendResponse)
def get_cloud_account(
    account_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get a specific cloud account by ID
    """
    # Check if user has permission to view cloud accounts
    has_permission = any(p.name == "view:cloud-accounts" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        account = db.query(CloudAccount).filter(CloudAccount.account_id == account_id).first()
        
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Cloud account with ID {account_id} not found"
            )
        
        # Check if user has access to this account's tenant
        if account.tenant_id != current_user.tenant_id:
            # Admin users can view all accounts
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to access this cloud account"
                )
        
        # Convert to frontend-compatible format
        return CloudAccountFrontendResponse(
            id=account.account_id,
            name=account.name,
            provider=account.provider,
            status=account.status,
            tenantId=current_user.tenant.tenant_id,
            connectionDetails={}  # Would need to add a connection_details field
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving cloud account: {str(e)}"
        )


@router.post("/", response_model=CloudAccountFrontendResponse)
def create_cloud_account(
    account: CloudAccountCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Create a new cloud account
    """
    # Check if user has permission to create cloud accounts
    has_permission = any(p.name == "create:cloud-accounts" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Create new cloud account
        import uuid
        new_account = CloudAccount(
            account_id=str(uuid.uuid4()),
            name=account.name,
            provider=account.provider,
            status=account.status,
            description=account.description,
            tenant_id=current_user.tenant_id
        )
        
        db.add(new_account)
        db.commit()
        db.refresh(new_account)
        
        # Return frontend-compatible response
        return CloudAccountFrontendResponse(
            id=new_account.account_id,
            name=new_account.name,
            provider=new_account.provider,
            status=new_account.status,
            tenantId=current_user.tenant.tenant_id,
            connectionDetails={}
        )
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating cloud account: {str(e)}"
        )


@router.put("/{account_id}", response_model=CloudAccountFrontendResponse)
def update_cloud_account(
    account_id: str,
    account_update: CloudAccountUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Update a cloud account
    """
    # Check if user has permission to update cloud accounts
    has_permission = any(p.name == "update:cloud-accounts" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Get the cloud account
        account = db.query(CloudAccount).filter(CloudAccount.account_id == account_id).first()
        
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Cloud account with ID {account_id} not found"
            )
        
        # Check if user has access to this account's tenant
        if account.tenant_id != current_user.tenant_id:
            # Admin users can update all accounts
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to update this cloud account"
                )
        
        # Update account
        account.name = account_update.name
        account.provider = account_update.provider
        account.status = account_update.status
        account.description = account_update.description
        
        db.commit()
        db.refresh(account)
        
        # Return frontend-compatible response
        return CloudAccountFrontendResponse(
            id=account.account_id,
            name=account.name,
            provider=account.provider,
            status=account.status,
            tenantId=current_user.tenant.tenant_id,
            connectionDetails={}
        )
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating cloud account: {str(e)}"
        )


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cloud_account(
    account_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Delete a cloud account
    """
    # Check if user has permission to delete cloud accounts
    has_permission = any(p.name == "delete:cloud-accounts" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Get the cloud account
        account = db.query(CloudAccount).filter(CloudAccount.account_id == account_id).first()
        
        if not account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Cloud account with ID {account_id} not found"
            )
        
        # Check if user has access to this account's tenant
        if account.tenant_id != current_user.tenant_id:
            # Admin users can delete all accounts
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to delete this cloud account"
                )
        
        # Check if account is used by any deployments
        deployments = db.query(CloudAccount).filter(CloudAccount.id == account.id).first()
        if deployments:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete cloud account that is used by deployments"
            )
        
        # Delete account
        db.delete(account)
        db.commit()
        
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting cloud account: {str(e)}"
        )


@router.options("/")
def options_cloud_accounts():
    """
    Handle preflight requests for cloud accounts
    """
    response = Response(status_code=200)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response


@router.options("/{account_id}")
def options_cloud_account_by_id():
    """
    Handle preflight requests for specific cloud account
    """
    response = Response(status_code=200)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response


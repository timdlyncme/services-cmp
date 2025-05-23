from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Query
from sqlalchemy.orm import Session
import json

from app.api.endpoints.auth import get_current_user
from app.db.session import get_db
from app.models.user import User, Tenant
from app.models.deployment import CloudAccount
from app.models.cloud_settings import CloudSettings
from app.schemas.deployment import (
    CloudAccountResponse, CloudAccountCreate, CloudAccountUpdate,
    CloudAccountFrontendResponse
)
from app.core.utils import format_error_response
import requests

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
        query = db.query(CloudAccount).join(Tenant, CloudAccount.tenant_id == Tenant.tenant_id)
        
        # Filter by tenant
        if not tenant_id:
            # Use the user's tenant if no tenant_id is provided
            tenant_id = current_user.tenant.tenant_id
        
        # Check if tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tenant with ID {tenant_id} not found"
            )
        
        # Filter by tenant
        query = query.filter(CloudAccount.tenant_id == tenant_id)
        
        # Get all cloud accounts
        cloud_accounts = query.all()
        
        # Format response
        result = []
        for account in cloud_accounts:
            # Get cloud settings if available
            connection_details = {}
            if account.cloud_settings:
                connection_details = {
                    "client_id": account.cloud_settings.client_id,
                    "tenant_id": account.cloud_settings.tenant_id,
                }
            
            # Format subscription IDs
            subscription_ids = []
            if account.subscription_ids:
                if isinstance(account.subscription_ids, str):
                    try:
                        subscription_ids = json.loads(account.subscription_ids)
                    except:
                        subscription_ids = [account.subscription_ids]
                else:
                    subscription_ids = account.subscription_ids
            elif account.subscription_id:
                subscription_ids = [account.subscription_id]
            
            result.append({
                "id": account.account_id,
                "name": account.name,
                "provider": account.provider,
                "status": account.status,
                "tenantId": account.tenant_id,
                "subscription_id": account.subscription_id,
                "subscription_ids": subscription_ids,
                "settings_id": account.cloud_settings.settings_id if account.cloud_settings else None,
                "connectionDetails": connection_details
            })
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        # Use format_error_response to avoid exposing sensitive information
        error_response = format_error_response(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response["detail"]
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
        # Get the cloud account
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
        
        # Get the tenant associated with this account
        tenant = db.query(Tenant).filter(Tenant.id == account.tenant_id).first()
        
        # Use the tenant_id from the tenant record, not the numeric ID
        tenant_id_for_response = None
        if tenant:
            tenant_id_for_response = tenant.tenant_id
        else:
            # Fallback to current user's tenant if no tenant found
            tenant_id_for_response = current_user.tenant.tenant_id
        
        # Get settings_id string if available
        settings_id_str = None
        if account.settings_id:
            from app.models.cloud_settings import CloudSettings
            settings = db.query(CloudSettings).filter(CloudSettings.id == account.settings_id).first()
            if settings:
                settings_id_str = str(settings.settings_id)
        
        # Return frontend-compatible response
        return CloudAccountFrontendResponse(
            id=account.account_id,
            name=account.name,
            provider=account.provider,
            status=account.status,
            tenantId=tenant.tenant_id if tenant else account.tenant_id,
            subscription_id=account.subscription_id,
            settings_id=settings_id_str,
            connectionDetails={}
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving cloud account: {str(e)}"
        )


@router.post("/", response_model=CloudAccountResponse)
def create_cloud_account(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    cloud_account_in: CloudAccountCreate
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
        # Get cloud settings if settings_id is provided
        cloud_settings = None
        if cloud_account_in.settings_id:
            cloud_settings = db.query(CloudSettings).filter(
                CloudSettings.settings_id == cloud_account_in.settings_id,
                CloudSettings.organization_tenant_id == current_user.tenant.tenant_id
            ).first()
            
            if not cloud_settings:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Cloud settings with ID {cloud_account_in.settings_id} not found"
                )
        
        # Create new cloud account
        cloud_account = CloudAccount(
            name=cloud_account_in.name,
            provider=cloud_account_in.provider,
            status=cloud_account_in.status,
            description=cloud_account_in.description,
            tenant_id=current_user.tenant.tenant_id,
            settings_id=cloud_settings.id if cloud_settings else None,
            subscription_ids=cloud_account_in.subscription_ids
        )
        
        # If there's only one subscription ID, also set it in the legacy field
        if cloud_account_in.subscription_ids and len(cloud_account_in.subscription_ids) == 1:
            cloud_account.subscription_id = cloud_account_in.subscription_ids[0]
        
        db.add(cloud_account)
        db.commit()
        db.refresh(cloud_account)
        
        return cloud_account
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        # Use format_error_response to avoid exposing sensitive information
        error_response = format_error_response(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response["detail"]
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
        
        # If settings_id is provided, verify it exists
        settings_id = account.settings_id
        if account_update.settings_id:
            # Get credential from database
            from app.models.cloud_settings import CloudSettings
            creds = db.query(CloudSettings).filter(
                CloudSettings.organization_tenant_id == account.tenant_id,
                CloudSettings.provider == account.provider,
                CloudSettings.settings_id == account_update.settings_id
            ).first()
            
            if not creds:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Credential not found"
                )
            
            settings_id = creds.id
        
        # Update account
        if account_update.name is not None:
            account.name = account_update.name
        if account_update.provider is not None:
            account.provider = account_update.provider
        if account_update.status is not None:
            account.status = account_update.status
        if account_update.description is not None:
            account.description = account_update.description
        if account_update.subscription_id is not None:
            account.subscription_id = account_update.subscription_id
        if settings_id is not None:
            account.settings_id = settings_id
        
        db.commit()
        db.refresh(account)
        
        # Get the tenant associated with this account
        tenant = db.query(Tenant).filter(Tenant.id == account.tenant_id).first()
        
        # Get settings_id string if available
        settings_id_str = None
        if account.settings_id:
            from app.models.cloud_settings import CloudSettings
            settings = db.query(CloudSettings).filter(CloudSettings.id == account.settings_id).first()
            if settings:
                settings_id_str = str(settings.settings_id)
        
        # Return frontend-compatible response
        return CloudAccountFrontendResponse(
            id=account.account_id,
            name=account.name,
            provider=account.provider,
            status=account.status,
            tenantId=tenant.tenant_id if tenant else current_user.tenant.tenant_id,
            subscription_id=account.subscription_id,
            settings_id=settings_id_str,
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


@router.delete("/{account_id}")
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


# Azure Subscription Schemas
from pydantic import BaseModel

class AzureSubscriptionResponse(BaseModel):
    id: str
    name: str
    state: str
    tenant_id: str

@router.get("/azure-credentials/{settings_id}/subscriptions", response_model=List[AzureSubscriptionResponse])
def list_azure_subscriptions(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings_id: str
):
    """
    List available Azure subscriptions for a specific credential
    """
    # Check if user has permission to view cloud accounts
    has_permission = any(p.name == "view:cloud-accounts" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Get credential from database
        from app.models.cloud_settings import CloudSettings
        creds = db.query(CloudSettings).filter(
            CloudSettings.organization_tenant_id == current_user.tenant.tenant_id,
            CloudSettings.provider == "azure",
            CloudSettings.settings_id == settings_id
        ).first()
        
        if not creds:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Credential not found"
            )
        
        # Forward request to deployment engine
        headers = {"Authorization": f"Bearer {current_user.access_token}"}
        
        # First set the credentials
        from app.api.endpoints.deployments import DEPLOYMENT_ENGINE_URL
        set_response = requests.post(
            f"{DEPLOYMENT_ENGINE_URL}/credentials",
            headers=headers,
            json={
                "client_id": creds.client_id,
                "client_secret": creds.client_secret,
                "tenant_id": creds.tenant_id
            }
        )
        
        if set_response.status_code != 200:
            raise Exception(f"Error setting credentials: {set_response.text}")
        
        # Then list subscriptions
        response = requests.get(
            f"{DEPLOYMENT_ENGINE_URL}/credentials/subscriptions",
            headers=headers
        )
        
        if response.status_code != 200:
            raise Exception(f"Error listing subscriptions: {response.text}")
        
        return response.json()
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error listing subscriptions: {str(e)}"
        )

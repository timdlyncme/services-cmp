from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from datetime import datetime

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.deployment import Environment, CloudAccount
from app.schemas.environment_resources import CloudResourceResponse
from app.core.azure_client import get_azure_resources_for_subscriptions

router = APIRouter()

@router.get("/{environment_id}/resources", response_model=List[CloudResourceResponse])
def get_environment_resources(
    environment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get all cloud resources for a specific environment
    """
    # Check if user has permission to view environments
    has_permission = any(p.name == "view:environments" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Get the environment
        environment = db.query(Environment).filter(Environment.environment_id == environment_id).first()
        
        if not environment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Environment with ID {environment_id} not found"
            )
        
        # Check if user has access to this environment's tenant
        if environment.tenant_id != current_user.tenant.tenant_id:
            # Admin users can view all environments
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to access this environment"
                )
        
        # Get all cloud accounts for this environment
        cloud_accounts = environment.cloud_accounts
        
        # Initialize resources list
        all_resources = []
        
        # Process Azure cloud accounts
        azure_accounts = [account for account in cloud_accounts if account.provider == "azure"]
        if azure_accounts:
            for account in azure_accounts:
                # Get Azure credentials
                settings_id = account.settings_id
                if not settings_id:
                    continue
                
                # Get subscription IDs from cloud_ids
                subscription_ids = account.cloud_ids if account.cloud_ids else []
                
                if not subscription_ids:
                    continue
                
                # Get Azure resources for these subscriptions
                try:
                    azure_resources = get_azure_resources_for_subscriptions(settings_id, subscription_ids)
                    
                    # Convert to response format
                    for resource in azure_resources:
                        all_resources.append(CloudResourceResponse(
                            id=resource.get("id", ""),
                            name=resource.get("name", ""),
                            type=resource.get("type", "").split("/")[-1],  # Extract resource type from full type
                            region=resource.get("location", ""),
                            status="running",  # Default status
                            provider="azure",
                            created_at=datetime.utcnow().isoformat(),  # Azure doesn't provide creation time in this API
                            subscription_id=resource.get("subscription_id", ""),
                            resource_group=resource.get("resource_group", ""),
                            tags=resource.get("tags", {})
                        ))
                except Exception as e:
                    # Log the error but continue with other accounts
                    print(f"Error getting Azure resources for account {account.name}: {str(e)}")
        
        # TODO: Add support for AWS and GCP resources
        
        return all_resources
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving environment resources: {str(e)}"
        )


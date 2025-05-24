from typing import Any, List, Optional
import os
import requests
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session
from datetime import datetime

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.deployment import Environment, CloudAccount, CloudSettings
from app.schemas.environment_resources import CloudResourceResponse

# Use the same deployment engine URL as in deployments.py
DEPLOYMENT_ENGINE_URL = os.getenv("DEPLOYMENT_ENGINE_URL", "http://deployment-engine:5000")

router = APIRouter()

@router.get("/{environment_id}/resources", response_model=List[CloudResourceResponse])
def get_environment_resources(
    environment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get all cloud resources for a specific environment by calling the deployment container
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
        
        # Process each cloud account
        for account in cloud_accounts:
            # Get cloud settings
            settings_id = account.settings_id
            if not settings_id:
                continue
                
            # Get cloud settings from database
            creds = db.query(CloudSettings).filter(
                CloudSettings.id == settings_id
            ).first()
            
            if not creds:
                continue
                
            # Get subscription IDs from cloud_ids
            subscription_ids = account.cloud_ids if account.cloud_ids else []
            
            if not subscription_ids:
                continue
                
            # Set up headers for deployment engine request
            headers = {"Authorization": f"Bearer {current_user.access_token}"}
            
            # First set the credentials in the deployment engine
            set_response = requests.post(
                f"{DEPLOYMENT_ENGINE_URL}/credentials",
                headers=headers,
                json={
                    "client_id": creds.client_id,
                    "client_secret": creds.client_secret,
                    "tenant_id": creds.tenant_id,
                    "provider": account.provider
                }
            )
            
            if set_response.status_code != 200:
                print(f"Error setting credentials for account {account.name}: {set_response.text}")
                continue
                
            # Then get resources from the deployment engine
            response = requests.get(
                f"{DEPLOYMENT_ENGINE_URL}/credentials/resources",
                headers=headers,
                params={"subscription_ids": ",".join(subscription_ids)}
            )
            
            if response.status_code != 200:
                print(f"Error getting resources for account {account.name}: {response.text}")
                continue
                
            # Process the resources
            resources = response.json()
            
            # Add resources to the list
            for resource in resources:
                all_resources.append(CloudResourceResponse(
                    id=resource.get("id", ""),
                    name=resource.get("name", ""),
                    type=resource.get("type", ""),
                    region=resource.get("location", ""),
                    status=resource.get("status", "running"),
                    provider=account.provider,
                    created_at=resource.get("created_at", datetime.utcnow().isoformat()),
                    subscription_id=resource.get("subscription_id", ""),
                    resource_group=resource.get("resource_group", ""),
                    tags=resource.get("tags", {})
                ))
        
        return all_resources
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving environment resources: {str(e)}"
        )

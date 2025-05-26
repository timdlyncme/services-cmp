from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
import requests
import os
import json
import logging

from app.db.session import get_db
from app.api.endpoints.auth import get_current_user
from app.models.user import User
from app.models.deployment import Deployment
from app.models.deployment_details import DeploymentDetails
from app.models.cloud_settings import CloudSettings

router = APIRouter()

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Deployment engine API URL
DEPLOYMENT_ENGINE_URL = os.getenv("DEPLOYMENT_ENGINE_URL", "http://deployment-engine:5000")

@router.get("/{resource_id}")
def get_resource_details(
    resource_id: str,
    cloud_settings_id: str = Query(..., description="The cloud settings ID to use for authentication"),
    deployment_id: Optional[str] = Query(None, description="Optional deployment ID that contains this resource"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get details for a specific Azure resource
    """
    # Check if user has permission to view resources
    has_permission = any(p.name == "view:deployments" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # If deployment_id is provided, verify access
        if deployment_id:
            # Find the deployment
            deployment = db.query(Deployment).filter(Deployment.deployment_id == deployment_id).first()
            if not deployment:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Deployment with ID {deployment_id} not found"
                )
            
            # Check if user has access to this deployment's tenant
            if deployment.tenant_id != current_user.tenant_id:
                # Admin users can view all deployments
                if current_user.role.name != "admin" and current_user.role.name != "msp":
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Not authorized to view this deployment"
                    )
        
        # Get cloud settings for authentication
        cloud_settings = db.query(CloudSettings).filter(
            CloudSettings.settings_id == cloud_settings_id
        ).first()
        
        if not cloud_settings:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Cloud settings with ID {cloud_settings_id} not found"
            )
        
        # Check if user has access to these cloud settings
        if cloud_settings.tenant_id != current_user.tenant_id:
            # Admin users can access all cloud settings
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to access these cloud settings"
                )
        
        # Extract credentials from connection_details
        if not cloud_settings.connection_details:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cloud settings do not contain connection details"
            )
        
        # Check if connection_details is a string (JSON) and parse it
        if isinstance(cloud_settings.connection_details, str):
            try:
                connection_details = json.loads(cloud_settings.connection_details)
            except json.JSONDecodeError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid connection details format"
                )
        else:
            connection_details = cloud_settings.connection_details
        
        # Extract credentials
        client_id = connection_details.get("client_id", "")
        client_secret = connection_details.get("client_secret", "")
        tenant_id = connection_details.get("tenant_id", "")
        
        if not client_id or not client_secret or not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required credentials in cloud settings"
            )
        
        # Get subscription ID from resource ID
        subscription_id = None
        if resource_id.startswith("/subscriptions/"):
            # Parse the Azure resource ID to extract subscription ID
            # Format: /subscriptions/{subscription_id}/resourceGroups/{resource_group}/providers/{provider}/{resource_type}/{resource_name}
            parts = resource_id.split("/")
            if len(parts) > 2 and parts[1] == "subscriptions":
                subscription_id = parts[2]
        
        # Forward request to deployment engine
        headers = {"Authorization": f"Bearer {current_user.access_token}"}
        
        # First set the credentials
        set_response = requests.post(
            f"{DEPLOYMENT_ENGINE_URL}/credentials",
            headers=headers,
            json={
                "client_id": client_id,
                "client_secret": client_secret,
                "tenant_id": tenant_id,
                "subscription_id": subscription_id
            }
        )
        
        if set_response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error setting credentials: {set_response.text}"
            )
        
        # Then get resource details
        response = requests.get(
            f"{DEPLOYMENT_ENGINE_URL}/resources/{resource_id}",
            headers=headers,
            params={"subscription_id": subscription_id} if subscription_id else {}
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error getting resource details: {response.text}"
            )
        
        return response.json()
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting resource details: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error getting resource details: {str(e)}"
        )


from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import requests
import os
import json

from app.db.session import get_db
from app.api.endpoints.auth import get_current_user
from app.models.user import User
from app.models.deployment import Deployment
from app.models.deployment_details import DeploymentDetails
from app.models.cloud_settings import CloudSettings

router = APIRouter()

# Deployment engine API URL
DEPLOYMENT_ENGINE_URL = os.getenv("DEPLOYMENT_ENGINE_URL", "http://deployment-engine:5000")

@router.get("/{resource_id}")
def get_resource_details(
    resource_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get details for a specific resource
    """
    # Check if user has permission to view resources
    has_permission = any(p.name == "view:deployments" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Find deployments that contain this resource
        deployments = db.query(Deployment).all()
        
        deployment_id = None
        resource_details = None
        
        # Search for the resource in all deployments
        for deployment in deployments:
            if not deployment.resources:
                continue
            
            resources = json.loads(deployment.resources) if isinstance(deployment.resources, str) else deployment.resources
            
            for resource in resources:
                if resource.get("id") == resource_id or resource_id in resource.get("id", ""):
                    deployment_id = deployment.deployment_id
                    resource_details = resource
                    break
            
            if deployment_id:
                break
        
        if not deployment_id or not resource_details:
            # If not found in deployments, try to get it from the deployment engine
            try:
                response = requests.get(
                    f"{DEPLOYMENT_ENGINE_URL}/resources/{resource_id}",
                    headers={"Authorization": f"Bearer {current_user.access_token}"}
                )
                
                if response.status_code == 200:
                    return response.json()
                else:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Resource with ID {resource_id} not found"
                    )
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error retrieving resource from deployment engine: {str(e)}"
                )
        
        # Get deployment details
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
                    detail="Not authorized to view this resource"
                )
        
        # Return resource details
        return {
            "id": resource_details.get("id"),
            "name": resource_details.get("name"),
            "type": resource_details.get("type"),
            "location": resource_details.get("location"),
            "properties": resource_details.get("properties", {}),
            "deploymentId": deployment_id,
            "tenantId": deployment.tenant_id
        }
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving resource details: {str(e)}"
        )


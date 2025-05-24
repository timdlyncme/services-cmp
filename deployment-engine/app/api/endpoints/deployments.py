from fastapi import APIRouter, Depends, HTTPException, status, Body
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import requests
import json
from typing import Dict, Any, List, Optional
from datetime import datetime
import uuid

from app.core.config import settings
from app.schemas.deployment import (
    DeploymentCreate,
    DeploymentResponse,
    DeploymentUpdate,
    DeploymentStatus
)
from app.services.deployment_service import DeploymentService
from app.api.deps import get_current_user, get_deployment_service

router = APIRouter()
security = HTTPBearer()

@router.post("/", response_model=DeploymentResponse)
async def create_deployment(
    *,
    deployment_in: DeploymentCreate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    deployment_service: DeploymentService = Depends(get_deployment_service)
) -> Any:
    """
    Create a new deployment
    """
    # Create deployment
    deployment = await deployment_service.create_deployment(
        deployment_in=deployment_in,
        user_id=current_user["user_id"],
        tenant_id=current_user["tenant_id"]
    )
    
    return deployment

@router.get("/{deployment_id}", response_model=DeploymentResponse)
async def get_deployment(
    *,
    deployment_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    deployment_service: DeploymentService = Depends(get_deployment_service)
) -> Any:
    """
    Get deployment by ID
    """
    # Get deployment
    deployment = await deployment_service.get_deployment(
        deployment_id=deployment_id,
        tenant_id=current_user["tenant_id"]
    )
    
    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Deployment with ID {deployment_id} not found"
        )
    
    return deployment

@router.get("/", response_model=List[DeploymentResponse])
async def get_deployments(
    *,
    environment_id: Optional[str] = None,
    cloud_account_id: Optional[str] = None,
    status: Optional[DeploymentStatus] = None,
    limit: int = 100,
    offset: int = 0,
    current_user: Dict[str, Any] = Depends(get_current_user),
    deployment_service: DeploymentService = Depends(get_deployment_service)
) -> Any:
    """
    Get all deployments with optional filtering
    """
    # Get deployments
    deployments = await deployment_service.get_deployments(
        tenant_id=current_user["tenant_id"],
        environment_id=environment_id,
        cloud_account_id=cloud_account_id,
        status=status,
        limit=limit,
        offset=offset
    )
    
    return deployments

@router.put("/{deployment_id}", response_model=DeploymentResponse)
async def update_deployment(
    *,
    deployment_id: str,
    deployment_update: DeploymentUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
    deployment_service: DeploymentService = Depends(get_deployment_service)
) -> Any:
    """
    Update deployment status and details
    """
    # Update deployment
    deployment = await deployment_service.update_deployment(
        deployment_id=deployment_id,
        deployment_update=deployment_update,
        tenant_id=current_user["tenant_id"],
        user_id=current_user["user_id"]
    )
    
    if not deployment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Deployment with ID {deployment_id} not found"
        )
    
    return deployment

@router.delete("/{deployment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deployment(
    *,
    deployment_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
    deployment_service: DeploymentService = Depends(get_deployment_service)
) -> Any:
    """
    Delete a deployment
    """
    # Delete deployment
    success = await deployment_service.delete_deployment(
        deployment_id=deployment_id,
        tenant_id=current_user["tenant_id"]
    )
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Deployment with ID {deployment_id} not found"
        )
    
    return None


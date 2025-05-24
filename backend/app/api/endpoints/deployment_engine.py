from fastapi import APIRouter, Depends, HTTPException, Body, Query, Path
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import requests
import os
from datetime import datetime
import logging

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.models.cloud_settings import CloudSettings
from app.schemas.deployment import DeploymentResponse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("deployment_engine")

router = APIRouter()

# Deployment engine API URL
DEPLOYMENT_ENGINE_URL = os.getenv("DEPLOYMENT_ENGINE_URL", "http://deployment-engine:5000")

# Cloud Settings Schemas
from pydantic import BaseModel

class AzureCredentialsCreate(BaseModel):
    client_id: str
    client_secret: str
    tenant_id: str
    subscription_id: str

class AzureCredentialsResponse(BaseModel):
    client_id: str
    tenant_id: str
    subscription_id: str
    configured: bool
    message: str

@router.post("/credentials", response_model=Dict[str, str])
def set_azure_credentials(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    credentials: AzureCredentialsCreate
):
    """
    Set Azure credentials for deployments
    """
    # Check if user has permission to manage credentials
    if not current_user.role or "deployment:manage" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        # Check if credentials already exist for this tenant
        existing_creds = db.query(CloudSettings).filter(
            CloudSettings.organization_tenant_id == current_user.tenant_id,
            CloudSettings.provider == "azure"
        ).first()
        
        if existing_creds:
            # Update existing credentials
            existing_creds.client_id = credentials.client_id
            existing_creds.client_secret = credentials.client_secret
            existing_creds.tenant_id = credentials.tenant_id
            existing_creds.subscription_id = credentials.subscription_id
            existing_creds.updated_at = datetime.utcnow()
            db.commit()
        else:
            # Create new credentials
            new_creds = CloudSettings(
                provider="azure",
                client_id=credentials.client_id,
                client_secret=credentials.client_secret,
                tenant_id=credentials.tenant_id,
                subscription_id=credentials.subscription_id,
                organization_tenant_id=current_user.tenant_id
            )
            db.add(new_creds)
            db.commit()
        
        # Forward credentials to deployment engine
        headers = {"Authorization": f"Bearer {get_token_for_deployment_engine(current_user)}"}
        response = requests.post(
            f"{DEPLOYMENT_ENGINE_URL}/credentials",
            headers=headers,
            json=credentials.dict()
        )
        
        if response.status_code != 200:
            raise Exception(f"Deployment engine error: {response.text}")
        
        return {"message": "Azure credentials updated successfully"}
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/credentials", response_model=AzureCredentialsResponse)
def get_azure_credentials(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get Azure credentials status
    """
    # Check if user has permission to view credentials
    if not current_user.role or "deployment:read" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        # Get credentials from database
        creds = db.query(CloudSettings).filter(
            CloudSettings.organization_tenant_id == current_user.tenant_id,
            CloudSettings.provider == "azure"
        ).first()
        
        if not creds:
            return {
                "client_id": "",
                "tenant_id": "",
                "subscription_id": "",
                "configured": False,
                "message": "Azure credentials not configured"
            }
        
        # Forward request to deployment engine
        headers = {"Authorization": f"Bearer {get_token_for_deployment_engine(current_user)}"}
        response = requests.get(
            f"{DEPLOYMENT_ENGINE_URL}/credentials",
            headers=headers
        )
        
        if response.status_code != 200:
            return {
                "client_id": creds.client_id,
                "tenant_id": creds.tenant_id,
                "subscription_id": creds.subscription_id,
                "configured": True,
                "message": f"Error checking credentials: {response.text}"
            }
        
        result = response.json()
        
        return {
            "client_id": creds.client_id,
            "tenant_id": creds.tenant_id,
            "subscription_id": creds.subscription_id,
            "configured": result.get("configured", False),
            "message": result.get("message", "")
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Template Deployment Schemas
class TemplateData(BaseModel):
    source: str  # url or code
    url: Optional[str] = None
    code: Optional[str] = None

class DeploymentCreate(BaseModel):
    name: str
    description: Optional[str] = None
    deployment_type: str  # arm or bicep
    resource_group: str
    location: str
    template: TemplateData
    parameters: Optional[Dict[str, Any]] = None

@router.post("/deployments", response_model=DeploymentResponse)
def create_deployment(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    deployment_in: DeploymentCreate
):
    """
    Create a new deployment using the deployment engine
    """
    # Check if user has permission to create deployments
    if not current_user.role or "deployment:create" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        # Debug: Log the deployment request
        logger.info(f"Creating deployment: {deployment_in.name}")
        logger.debug(f"Deployment data: {deployment_in.dict(exclude={'template': {'code'}})}")
        logger.debug(f"Template code length: {len(deployment_in.template.code) if deployment_in.template and deployment_in.template.code else 0}")
        
        # Ensure template code is not None
        if deployment_in.template and deployment_in.template.source == 'code':
            if deployment_in.template.code is None:
                deployment_in.template.code = ""
                logger.warning("Template code was None, setting to empty string")
        
        # Forward request to deployment engine
        headers = {"Authorization": f"Bearer {get_token_for_deployment_engine(current_user)}"}
        
        # Debug: Log the request to deployment engine
        logger.info(f"Sending request to deployment engine: {DEPLOYMENT_ENGINE_URL}/deployments")
        
        response = requests.post(
            f"{DEPLOYMENT_ENGINE_URL}/deployments",
            headers=headers,
            json=deployment_in.dict()
        )
        
        # Debug: Log the response from deployment engine
        logger.info(f"Deployment engine response status: {response.status_code}")
        if response.status_code != 200:
            logger.error(f"Deployment engine error: {response.text}")
            raise Exception(f"Deployment engine error: {response.text}")
        
        result = response.json()
        logger.info(f"Deployment created successfully: {result.get('deployment_id')}")
        
        return {
            "id": result["deployment_id"],
            "name": deployment_in.name,
            "status": result["status"],
            "created_at": result["created_at"],
            "cloud_deployment_id": result.get("azure_deployment_id")
        }
    
    except Exception as e:
        logger.error(f"Error creating deployment: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/deployments", response_model=List[DeploymentResponse])
def list_deployments(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    status: Optional[str] = None,
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """
    List deployments with optional filtering
    """
    # Check if user has permission to view deployments
    if not current_user.role or "deployment:read" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        # Debug: Log the request
        logger.info(f"Listing deployments: status={status}, limit={limit}, offset={offset}")
        
        # Forward request to deployment engine
        headers = {"Authorization": f"Bearer {get_token_for_deployment_engine(current_user)}"}
        params = {"limit": limit, "offset": offset}
        if status:
            params["status"] = status
        
        logger.info(f"Sending request to deployment engine: {DEPLOYMENT_ENGINE_URL}/deployments")
        
        response = requests.get(
            f"{DEPLOYMENT_ENGINE_URL}/deployments",
            headers=headers,
            params=params
        )
        
        # Debug: Log the response
        logger.info(f"Deployment engine response status: {response.status_code}")
        
        if response.status_code != 200:
            logger.error(f"Deployment engine error: {response.text}")
            raise Exception(f"Deployment engine error: {response.text}")
        
        result = response.json()
        logger.info(f"Retrieved {len(result)} deployments")
        
        # Format response
        deployments = []
        for deployment in result:
            deployments.append({
                "id": deployment["deployment_id"],
                "name": deployment.get("name", ""),
                "status": deployment["status"],
                "created_at": deployment["created_at"],
                "cloud_deployment_id": deployment.get("azure_deployment_id")
            })
        
        return deployments
    
    except Exception as e:
        logger.error(f"Error listing deployments: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/deployments/{deployment_id}", response_model=Dict[str, Any])
def get_deployment(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    deployment_id: str
):
    """
    Get detailed information about a deployment
    """
    # Check if user has permission to view deployments
    if not current_user.role or "deployment:read" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        # Debug: Log the request
        logger.info(f"Getting deployment details: {deployment_id}")
        
        # Forward request to deployment engine
        headers = {"Authorization": f"Bearer {get_token_for_deployment_engine(current_user)}"}
        
        logger.info(f"Sending request to deployment engine: {DEPLOYMENT_ENGINE_URL}/deployments/{deployment_id}")
        
        response = requests.get(
            f"{DEPLOYMENT_ENGINE_URL}/deployments/{deployment_id}",
            headers=headers
        )
        
        # Debug: Log the response
        logger.info(f"Deployment engine response status: {response.status_code}")
        
        if response.status_code != 200:
            logger.error(f"Deployment engine error: {response.text}")
            raise Exception(f"Deployment engine error: {response.text}")
        
        result = response.json()
        logger.info(f"Retrieved deployment details for: {deployment_id}")
        
        return result
    
    except Exception as e:
        logger.error(f"Error getting deployment details: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

class DeploymentUpdate(BaseModel):
    template: Optional[TemplateData] = None
    parameters: Optional[Dict[str, Any]] = None

@router.put("/deployments/{deployment_id}", response_model=Dict[str, Any])
def update_deployment(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    deployment_id: str,
    deployment_in: DeploymentUpdate
):
    """
    Update an existing deployment
    """
    # Check if user has permission to update deployments
    if not current_user.role or "deployment:update" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        # Debug: Log the request
        logger.info(f"Updating deployment: {deployment_id}")
        logger.debug(f"Update data: {deployment_in.dict(exclude_none=True, exclude={'template': {'code'}})}")
        
        # Ensure template code is not None if present
        if deployment_in.template and deployment_in.template.source == 'code':
            if deployment_in.template.code is None:
                deployment_in.template.code = ""
                logger.warning("Template code was None, setting to empty string")
        
        # Forward request to deployment engine
        headers = {"Authorization": f"Bearer {get_token_for_deployment_engine(current_user)}"}
        
        logger.info(f"Sending request to deployment engine: {DEPLOYMENT_ENGINE_URL}/deployments/{deployment_id}")
        
        response = requests.put(
            f"{DEPLOYMENT_ENGINE_URL}/deployments/{deployment_id}",
            headers=headers,
            json=deployment_in.dict(exclude_none=True)
        )
        
        # Debug: Log the response
        logger.info(f"Deployment engine response status: {response.status_code}")
        
        if response.status_code != 200:
            logger.error(f"Deployment engine error: {response.text}")
            raise Exception(f"Deployment engine error: {response.text}")
        
        result = response.json()
        logger.info(f"Deployment updated successfully: {deployment_id}")
        
        return result
    
    except Exception as e:
        logger.error(f"Error updating deployment: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/deployments/{deployment_id}", response_model=Dict[str, Any])
def delete_deployment(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    deployment_id: str
):
    """
    Delete a deployment
    """
    # Check if user has permission to delete deployments
    if not current_user.role or "deployment:delete" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        # Debug: Log the request
        logger.info(f"Deleting deployment: {deployment_id}")
        
        # Forward request to deployment engine
        headers = {"Authorization": f"Bearer {get_token_for_deployment_engine(current_user)}"}
        
        logger.info(f"Sending request to deployment engine: {DEPLOYMENT_ENGINE_URL}/deployments/{deployment_id}")
        
        response = requests.delete(
            f"{DEPLOYMENT_ENGINE_URL}/deployments/{deployment_id}",
            headers=headers
        )
        
        # Debug: Log the response
        logger.info(f"Deployment engine response status: {response.status_code}")
        
        if response.status_code != 200:
            logger.error(f"Deployment engine error: {response.text}")
            raise Exception(f"Deployment engine error: {response.text}")
        
        result = response.json()
        logger.info(f"Deployment deleted successfully: {deployment_id}")
        
        return result
    
    except Exception as e:
        logger.error(f"Error deleting deployment: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

def get_token_for_deployment_engine(user: User) -> str:
    """
    Generate a JWT token for the deployment engine.
    This token should include the necessary permissions.
    """
    import jwt
    import time
    import logging
    
    logger = logging.getLogger(__name__)
    
    # Get permissions from user role
    permissions = []
    if user.role:
        permissions = [p.name for p in user.role.permissions]
    
    # Map permissions to deployment engine format
    deployment_permissions = []
    permission_mapping = {
        "view:deployments": "deployment:read",
        "create:deployments": "deployment:create",
        "update:deployments": "deployment:update",
        "delete:deployments": "deployment:delete",
        "deployment:read": "deployment:read",
        "deployment:create": "deployment:create",
        "deployment:update": "deployment:update",
        "deployment:delete": "deployment:delete",
        "deployment:manage": "deployment:manage"
    }
    
    for p in permissions:
        if p in permission_mapping:
            deployment_permissions.append(permission_mapping[p])
    
    # Add deployment:manage permission for the deployment engine
    if "deployment:create" in permissions or "deployment:update" in permissions or "deployment:delete" in permissions:
        if "deployment:manage" not in deployment_permissions:
            deployment_permissions.append("deployment:manage")
    
    logger.debug(f"User permissions: {permissions}")
    logger.debug(f"Deployment permissions: {deployment_permissions}")
    
    # Create token payload
    payload = {
        "sub": str(user.user_id),
        "name": user.username,
        "permissions": deployment_permissions,
        "tenant_id": str(user.tenant_id),
        "exp": int(time.time()) + 3600  # 1 hour expiration
    }
    
    logger.debug(f"Token payload: {payload}")
    
    # Sign token
    secret_key = os.getenv("JWT_SECRET", "your-secret-key")
    algorithm = os.getenv("JWT_ALGORITHM", "HS256")
    
    token = jwt.encode(
        payload,
        secret_key,
        algorithm=algorithm
    )
    
    logger.debug(f"Generated token for deployment engine (first 20 chars): {token[:20]}...")
    
    return token

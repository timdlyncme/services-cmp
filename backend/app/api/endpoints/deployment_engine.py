from fastapi import APIRouter, Depends, HTTPException, Body, Query, Path
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import requests
import os
from datetime import datetime

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.models.cloud_settings import CloudSettings
from app.schemas.deployment import DeploymentResponse

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
        # Forward request to deployment engine
        headers = {"Authorization": f"Bearer {get_token_for_deployment_engine(current_user)}"}
        response = requests.post(
            f"{DEPLOYMENT_ENGINE_URL}/deployments",
            headers=headers,
            json=deployment_in.dict()
        )
        
        if response.status_code != 200:
            raise Exception(f"Deployment engine error: {response.text}")
        
        result = response.json()
        
        return {
            "id": result["deployment_id"],
            "name": deployment_in.name,
            "status": result["status"],
            "created_at": result["created_at"],
            "cloud_deployment_id": result.get("azure_deployment_id")
        }
    
    except Exception as e:
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
        # Forward request to deployment engine
        headers = {"Authorization": f"Bearer {get_token_for_deployment_engine(current_user)}"}
        params = {"limit": limit, "offset": offset}
        if status:
            params["status"] = status
        
        response = requests.get(
            f"{DEPLOYMENT_ENGINE_URL}/deployments",
            headers=headers,
            params=params
        )
        
        if response.status_code != 200:
            raise Exception(f"Deployment engine error: {response.text}")
        
        result = response.json()
        
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
        # Forward request to deployment engine
        headers = {"Authorization": f"Bearer {get_token_for_deployment_engine(current_user)}"}
        response = requests.get(
            f"{DEPLOYMENT_ENGINE_URL}/deployments/{deployment_id}",
            headers=headers
        )
        
        if response.status_code != 200:
            raise Exception(f"Deployment engine error: {response.text}")
        
        return response.json()
    
    except Exception as e:
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
        # Forward request to deployment engine
        headers = {"Authorization": f"Bearer {get_token_for_deployment_engine(current_user)}"}
        response = requests.put(
            f"{DEPLOYMENT_ENGINE_URL}/deployments/{deployment_id}",
            headers=headers,
            json=deployment_in.dict(exclude_none=True)
        )
        
        if response.status_code != 200:
            raise Exception(f"Deployment engine error: {response.text}")
        
        return response.json()
    
    except Exception as e:
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
        # Forward request to deployment engine
        headers = {"Authorization": f"Bearer {get_token_for_deployment_engine(current_user)}"}
        response = requests.delete(
            f"{DEPLOYMENT_ENGINE_URL}/deployments/{deployment_id}",
            headers=headers
        )
        
        if response.status_code != 200:
            raise Exception(f"Deployment engine error: {response.text}")
        
        return response.json()
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def get_token_for_deployment_engine(user: User) -> str:
    """
    Generate a JWT token for the deployment engine.
    This token should include the necessary permissions.
    """
    import jwt
    import time
    
    # Get permissions from user role
    permissions = []
    if user.role:
        permissions = [p.name for p in user.role.permissions]
    
    # Add deployment:manage permission for the deployment engine
    if "deployment:create" in permissions or "deployment:update" in permissions or "deployment:delete" in permissions:
        permissions.append("deployment:manage")
    
    # Create token payload
    payload = {
        "sub": str(user.user_id),
        "name": user.username,
        "permissions": permissions,
        "tenant_id": str(user.tenant_id),
        "exp": int(time.time()) + 3600  # 1 hour expiration
    }
    
    # Sign token
    token = jwt.encode(
        payload,
        os.getenv("JWT_SECRET", "your-secret-key"),
        algorithm=os.getenv("JWT_ALGORITHM", "HS256")
    )
    
    return token


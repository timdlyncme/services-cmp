from typing import Any, List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Response, Query, Body, Path
from sqlalchemy.orm import Session
from sqlalchemy import func
import uuid
import requests
import os
from datetime import datetime

from app.api.endpoints.auth import get_current_user
from app.db.session import get_db
from app.models.user import User, Tenant
from app.models.deployment import Deployment, Template, Environment, CloudAccount
from app.models.cloud_settings import CloudSettings
from app.schemas.deployment import (
    DeploymentResponse, DeploymentCreate, DeploymentUpdate,
    CloudDeploymentResponse
)
from app.api.endpoints.environment_resources import get_token_for_deployment_engine

router = APIRouter()

# Deployment engine API URL
DEPLOYMENT_ENGINE_URL = os.getenv("DEPLOYMENT_ENGINE_URL", "http://deployment-engine:5000")

# Cloud Settings Schemas
from pydantic import BaseModel, Field

class AzureCredentialsCreate(BaseModel):
    name: str = Field(..., description="Friendly name for the credentials")
    client_id: str
    client_secret: str
    tenant_id: str

class AzureCredentialsResponse(BaseModel):
    id: int
    settings_id: str
    name: str
    client_id: str
    tenant_id: str
    configured: bool = False
    message: str = ""

@router.post("/azure_credentials", response_model=Dict[str, str])
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
        # Create new credentials
        new_creds = CloudSettings(
            provider="azure",
            name=credentials.name,
            client_id=credentials.client_id,
            client_secret=credentials.client_secret,
            tenant_id=credentials.tenant_id,
            organization_tenant_id=current_user.tenant.tenant_id
        )
        db.add(new_creds)
        db.commit()
        db.refresh(new_creds)
        
        # Forward credentials to deployment engine
        headers = {"Authorization": f"Bearer {get_token_for_deployment_engine(current_user)}"}
        response = requests.post(
            f"{DEPLOYMENT_ENGINE_URL}/credentials",
            headers=headers,
            json={
                "client_id": credentials.client_id,
                "client_secret": credentials.client_secret,
                "tenant_id": credentials.tenant_id
            }
        )
        
        if response.status_code != 200:
            raise Exception(f"Deployment engine error: {response.text}")
        
        return {"message": "Azure credentials added successfully", "settings_id": str(new_creds.settings_id)}
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/azure_credentials", response_model=List[AzureCredentialsResponse])
def get_azure_credentials(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all Azure credentials for the tenant
    """
    # Check if user has permission to view credentials
    if not current_user.role or "deployment:read" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        # Get all credentials from database
        creds_list = db.query(CloudSettings).filter(
            CloudSettings.organization_tenant_id == current_user.tenant.tenant_id,
            CloudSettings.provider == "azure"
        ).all()
        
        if not creds_list:
            return []
        
        # Forward request to deployment engine to check status
        headers = {"Authorization": f"Bearer {get_token_for_deployment_engine(current_user)}"}
        response = requests.get(
            f"{DEPLOYMENT_ENGINE_URL}/credentials",
            headers=headers
        )
        
        engine_status = {"configured": False, "message": "Unknown status"}
        if response.status_code == 200:
            engine_status = response.json()
        
        # Format response
        result = []
        for creds in creds_list:
            result.append({
                "id": creds.id,
                "settings_id": str(creds.settings_id),
                "name": creds.name or "Azure Credentials",
                "client_id": creds.client_id,
                "tenant_id": creds.tenant_id,
                "configured": engine_status.get("configured", False),
                "message": engine_status.get("message", "")
            })
        
        return result
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Azure Subscription Schemas
class AzureSubscriptionResponse(BaseModel):
    id: str
    name: str
    state: str
    tenant_id: str

@router.get("/azure_credentials/{settings_id}/subscriptions", response_model=List[AzureSubscriptionResponse])
def list_azure_subscriptions(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings_id: str
):
    """
    List available Azure subscriptions for a specific credential
    """
    # Check if user has permission to view credentials
    if not current_user.role or "deployment:read" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        # Get credential from database
        creds = db.query(CloudSettings).filter(
            CloudSettings.organization_tenant_id == current_user.tenant.tenant_id,
            CloudSettings.provider == "azure",
            CloudSettings.settings_id == settings_id
        ).first()
        
        if not creds:
            raise HTTPException(status_code=404, detail="Credential not found")
        
        # Forward request to deployment engine
        headers = {"Authorization": f"Bearer {get_token_for_deployment_engine(current_user)}"}
        
        # First set the credentials
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
        raise HTTPException(status_code=500, detail=str(e))

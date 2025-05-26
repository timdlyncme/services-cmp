from typing import Any, List, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Response, Query, Body, Path
from sqlalchemy.orm import Session
from sqlalchemy import func
import uuid
import requests
import os
import json
from datetime import datetime
from pydantic import BaseModel, Field

from app.db.session import get_db
from app.api.endpoints.auth import get_current_user
from app.models.user import User, Tenant
from app.models.deployment import Deployment, DeploymentHistory, Template, Environment, CloudAccount
from app.models.deployment_details import DeploymentDetails
from app.models.cloud_settings import CloudSettings
from app.schemas.deployment import (
    DeploymentResponse, DeploymentCreate as OldDeploymentCreate, DeploymentUpdate,
    CloudDeploymentResponse
)

router = APIRouter()

# Deployment engine API URL
DEPLOYMENT_ENGINE_URL = os.getenv("DEPLOYMENT_ENGINE_URL", "http://deployment-engine:5000")

# Cloud Settings Schemas
class AzureCredentialsCreate(BaseModel):
    name: str = Field(..., description="Friendly name for the credentials")
    client_id: str
    client_secret: str
    tenant_id: str

class AzureCredentialsResponse(BaseModel):
    id: str  # Changed from int to str to use UUID
    name: str
    client_id: str
    tenant_id: str
    configured: bool = False
    message: str = ""

# Updated deployment create model
class DeploymentCreate(BaseModel):
    name: str
    template_id: str
    environment: str
    resource_group: str
    location: str
    cloud_settings_id: str
    parameters: Dict[str, Any] = {}

@router.post("/azure_credentials", response_model=Dict[str, str])
def set_azure_credentials(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    credentials: AzureCredentialsCreate,
    tenant_id: Optional[str] = None
):
    """
    Set Azure credentials for deployments
    """
    # Check if user has permission to manage credentials
    if not current_user.role or "deployment:manage" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        # Use the provided tenant_id if it exists, otherwise use the current user's tenant
        creds_tenant_id = tenant_id if tenant_id else current_user.tenant.tenant_id
        
        # Check if tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == creds_tenant_id).first()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tenant with ID {creds_tenant_id} not found"
            )
        
        # Check if user has permission to create for this tenant
        if creds_tenant_id != current_user.tenant.tenant_id:
            # Only admin or MSP users can create for other tenants
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to create credentials for other tenants"
                )
        
        # Create new credentials with connection_details as JSON
        new_creds = CloudSettings(
            provider="azure",
            name=credentials.name,
            connection_details={
                "client_id": credentials.client_id,
                "client_secret": credentials.client_secret,
                "tenant_id": credentials.tenant_id
            },
            tenant_id=creds_tenant_id
        )
        db.add(new_creds)
        db.commit()
        db.refresh(new_creds)
        
        # Forward credentials to deployment engine
        headers = {"Authorization": f"Bearer {current_user.access_token}"}
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
        
        return {"message": "Azure credentials added successfully", "id": str(new_creds.settings_id)}
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/azure_credentials", response_model=List[AzureCredentialsResponse])
def get_azure_credentials(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    tenant_id: Optional[str] = None
):
    """
    Get all Azure credentials for the tenant
    """
    # Check if user has permission to view credentials
    if not current_user.role or "deployment:read" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        # Use the provided tenant_id if it exists, otherwise use the current user's tenant
        creds_tenant_id = tenant_id if tenant_id else current_user.tenant.tenant_id
        
        # Check if tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == creds_tenant_id).first()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tenant with ID {creds_tenant_id} not found"
            )
        
        # Check if user has permission to view credentials for this tenant
        if creds_tenant_id != current_user.tenant.tenant_id:
            # Only admin or MSP users can view credentials for other tenants
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to view credentials for other tenants"
                )
        
        # Get all credentials from database
        creds_list = db.query(CloudSettings).filter(
            CloudSettings.tenant_id == creds_tenant_id,
            CloudSettings.provider == "azure"
        ).all()
        
        if not creds_list:
            return []
        
        # Forward request to deployment engine to check status
        headers = {"Authorization": f"Bearer {current_user.access_token}"}
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
            # Extract client_id and tenant_id from connection_details
            client_id = ""
            tenant_id = ""
            if creds.connection_details:
                client_id = creds.connection_details.get("client_id", "")
                tenant_id = creds.connection_details.get("tenant_id", "")
            
            result.append({
                "id": str(creds.settings_id),  # Use settings_id as the ID
                "name": creds.name or "Azure Credentials",
                "client_id": client_id,
                "tenant_id": tenant_id,
                "configured": engine_status.get("configured", False),
                "message": engine_status.get("message", "")
            })
        
        return result
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/azure_credentials/{settings_id}", response_model=AzureCredentialsResponse)
def get_azure_credential(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings_id: str,
    tenant_id: Optional[str] = None
):
    """
    Get a specific Azure credential by settings_id
    """
    # Check if user has permission to view credentials
    if not current_user.role or "deployment:read" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        # Use the provided tenant_id if it exists, otherwise use the current user's tenant
        creds_tenant_id = tenant_id if tenant_id else current_user.tenant.tenant_id
        
        # Check if tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == creds_tenant_id).first()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tenant with ID {creds_tenant_id} not found"
            )
        
        # Check if user has permission to view credentials for this tenant
        if creds_tenant_id != current_user.tenant.tenant_id:
            # Only admin or MSP users can view credentials for other tenants
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to view credentials for other tenants"
                )
        
        # Get credential from database
        creds = db.query(CloudSettings).filter(
            CloudSettings.tenant_id == creds_tenant_id,
            CloudSettings.provider == "azure",
            CloudSettings.settings_id == settings_id
        ).first()
        
        if not creds:
            raise HTTPException(status_code=404, detail="Credential not found")
        
        # Forward request to deployment engine to check status
        headers = {"Authorization": f"Bearer {current_user.access_token}"}
        response = requests.get(
            f"{DEPLOYMENT_ENGINE_URL}/credentials",
            headers=headers
        )
        
        engine_status = {"configured": False, "message": "Unknown status"}
        if response.status_code == 200:
            engine_status = response.json()
        
        return {
            "id": str(creds.settings_id),  # Use settings_id as the ID
            "name": creds.name or "Azure Credentials",
            "client_id": creds.connection_details.get("client_id", "") if creds.connection_details else "",
            "tenant_id": creds.connection_details.get("tenant_id", "") if creds.connection_details else "",
            "configured": engine_status.get("configured", False),
            "message": engine_status.get("message", "")
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/azure_credentials/{settings_id}", response_model=Dict[str, str])
def delete_azure_credential(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings_id: str,
    tenant_id: Optional[str] = None
):
    """
    Delete a specific Azure credential by settings_id
    """
    # Check if user has permission to manage credentials
    if not current_user.role or "deployment:manage" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        # Use the provided tenant_id if it exists, otherwise use the current user's tenant
        creds_tenant_id = tenant_id if tenant_id else current_user.tenant.tenant_id
        
        # Check if tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == creds_tenant_id).first()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tenant with ID {creds_tenant_id} not found"
            )
        
        # Check if user has permission to delete credentials for this tenant
        if creds_tenant_id != current_user.tenant.tenant_id:
            # Only admin or MSP users can delete credentials for other tenants
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to delete credentials for other tenants"
                )
        
        # Get credential from database
        creds = db.query(CloudSettings).filter(
            CloudSettings.tenant_id == creds_tenant_id,
            CloudSettings.provider == "azure",
            CloudSettings.settings_id == settings_id
        ).first()
        
        if not creds:
            raise HTTPException(status_code=404, detail="Credential not found")
        
        # Check if credential is in use by any cloud accounts
        in_use = db.query(CloudAccount).filter(
            CloudAccount.settings_id == creds.id
        ).first()
        
        if in_use:
            raise HTTPException(
                status_code=400, 
                detail="Cannot delete credential that is in use by cloud accounts"
            )
        
        # Delete credential
        db.delete(creds)
        db.commit()
        
        return {"message": "Azure credential deleted successfully"}
    
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# Template Deployment Schemas
class TemplateData(BaseModel):
    source: str  # url or code
    url: Optional[str] = None
    code: Optional[str] = None

class DeploymentEngineCreate(BaseModel):
    name: str
    description: Optional[str] = None
    deployment_type: str  # arm or bicep
    resource_group: str
    location: str
    template: TemplateData
    parameters: Optional[Dict[str, Any]] = None

@router.post("/engine", response_model=DeploymentResponse)
def create_engine_deployment(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    deployment_in: DeploymentEngineCreate
):
    """
    Create a new deployment using the deployment engine
    """
    # Check if user has permission to create deployments
    if not current_user.role or "deployment:create" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        # Forward request to deployment engine
        headers = {"Authorization": f"Bearer {current_user.access_token}"}
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

@router.get("/engine", response_model=List[DeploymentResponse])
def list_engine_deployments(
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
        headers = {"Authorization": f"Bearer {current_user.access_token}"}
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

@router.get("/engine/{deployment_id}", response_model=Dict[str, Any])
def get_engine_deployment(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    deployment_id: str = Path(..., title="The ID of the deployment to get")
):
    """
    Get detailed information about a deployment
    """
    # Check if user has permission to view deployments
    if not current_user.role or "deployment:read" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        # Forward request to deployment engine
        headers = {"Authorization": f"Bearer {current_user.access_token}"}
        response = requests.get(
            f"{DEPLOYMENT_ENGINE_URL}/deployments/{deployment_id}",
            headers=headers
        )
        
        if response.status_code != 200:
            raise Exception(f"Deployment engine error: {response.text}")
        
        return response.json()
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class DeploymentEngineUpdate(BaseModel):
    template: Optional[TemplateData] = None
    parameters: Optional[Dict[str, Any]] = None

@router.put("/engine/{deployment_id}", response_model=Dict[str, Any])
def update_engine_deployment(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    deployment_id: str = Path(..., title="The ID of the deployment to update"),
    deployment_in: DeploymentEngineUpdate
):
    """
    Update an existing deployment
    """
    # Check if user has permission to update deployments
    if not current_user.role or "deployment:update" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        # Forward request to deployment engine
        headers = {"Authorization": f"Bearer {current_user.access_token}"}
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

@router.delete("/engine/{deployment_id}", response_model=Dict[str, Any])
def delete_engine_deployment(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    deployment_id: str = Path(..., title="The ID of the deployment to delete")
):
    """
    Delete a deployment
    """
    # Check if user has permission to delete deployments
    if not current_user.role or "deployment:delete" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        # Forward request to deployment engine
        headers = {"Authorization": f"Bearer {current_user.access_token}"}
        response = requests.delete(
            f"{DEPLOYMENT_ENGINE_URL}/deployments/{deployment_id}",
            headers=headers
        )
        
        if response.status_code != 200:
            raise Exception(f"Deployment engine error: {response.text}")
        
        return response.json()
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[CloudDeploymentResponse])
def get_deployments(
    tenant_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get all deployments for the current user's tenant or a specific tenant
    """
    # Add CORS headers
    response = Response()
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    
    # Check if user has permission to view deployments
    has_permission = any(p.name == "view:deployments" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        query = db.query(
            Deployment, Template, Environment, Tenant
        ).join(
            Template, Deployment.template_id == Template.id
        ).join(
            Environment, Deployment.environment_id == Environment.id
        ).join(
            Tenant, Deployment.tenant_id == Tenant.tenant_id  # Join on tenant_id (UUID) instead of id (Integer)
        )
        
        # Get the user's tenant
        user_tenant = db.query(Tenant).filter(Tenant.tenant_id == current_user.tenant_id).first()
        
        # Filter by tenant if specified
        if tenant_id:
            # Handle different tenant ID formats
            try:
                # Remove 'tenant-' prefix if present
                if tenant_id.startswith('tenant-'):
                    tenant_id = tenant_id[7:]
                
                # Check if tenant exists
                tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
                if not tenant:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Tenant with ID {tenant_id} not found"
                    )
                
                # Check if user has access to this tenant
                if tenant.tenant_id != current_user.tenant_id and current_user.role.name != "admin" and current_user.role.name != "msp":
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Not authorized to view deployments for this tenant"
                    )
                
                query = query.filter(Tenant.tenant_id == tenant_id)
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid tenant ID format: {str(e)}"
                )
        else:
            # No tenant specified, show deployments from the user's tenant
            if current_user.role.name == "admin" or current_user.role.name == "msp":
                # Admin and MSP users can see all deployments if no tenant is specified
                pass
            else:
                # Regular users can only see deployments from their tenant
                if user_tenant:
                    query = query.filter(Tenant.tenant_id == user_tenant.tenant_id)
        
        results = query.all()
        
        # Convert to frontend-compatible format
        deployments = []
        for deployment, template, environment, tenant in results:
            # Get provider from template
            provider = template.provider
            
            # Get region from parameters if available
            region = None
            if deployment.parameters and "region" in deployment.parameters:
                region = deployment.parameters["region"]
            
            # Get deployment details if available to fetch cloud_resources
            deployment_details = db.query(DeploymentDetails).filter(
                DeploymentDetails.deployment_id == deployment.id
            ).first()
            
            # Get resources from deployment details
            resources = []
            if deployment_details and deployment_details.cloud_resources:
                resources = deployment_details.cloud_resources
            
            deployments.append(CloudDeploymentResponse(
                id=deployment.deployment_id,
                name=deployment.name,
                templateId=template.template_id,
                templateName=template.name,
                provider=provider,
                status=deployment.status,
                environment=environment.name,
                createdAt=deployment.created_at.isoformat(),
                updatedAt=deployment.updated_at.isoformat(),
                parameters=deployment.parameters or {},
                resources=resources,  # Use resources from deployment_details
                tenantId=tenant.tenant_id,
                region=region
            ))
        
        return deployments
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving deployments: {str(e)}"
        )


@router.get("/{deployment_id}", response_model=CloudDeploymentResponse)
def get_deployment(
    deployment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Get a deployment by ID
    """
    # Check if user has permission to view deployments
    has_permission = any(p.name == "view:deployments" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
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
    
    # Get deployment details
    deployment_details = db.query(DeploymentDetails).filter(
        DeploymentDetails.deployment_id == deployment_id
    ).first()
    
    # Get cloud settings ID
    cloud_settings_id = None
    if deployment_details and deployment_details.cloud_settings_id:
        cloud_settings_id = deployment_details.cloud_settings_id
    
    # Format the response
    response = {
        "id": deployment.deployment_id,
        "name": deployment.name,
        "templateId": deployment.template_id,
        "templateName": deployment.template_name,
        "provider": deployment.provider,
        "status": deployment.status,
        "environment": deployment.environment,
        "createdAt": deployment.created_at.isoformat(),
        "updatedAt": deployment.updated_at.isoformat(),
        "parameters": json.loads(deployment.parameters) if deployment.parameters else {},
        "resources": json.loads(deployment.resources) if deployment.resources else [],
        "tenantId": deployment.tenant_id,
        "cloudSettingsId": cloud_settings_id
    }
    
    return response


@router.post("/")
def create_deployment(
    deployment_data: Dict[str, Any] = Body(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """
    Create a new deployment
    
    This endpoint supports both the old and new deployment formats
    """
    # Check if user has permission to create deployments
    has_permission = any(p.name == "create:deployments" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Determine if we're using the old or new format based on the presence of certain fields
        is_old_format = "environment_id" in deployment_data and "deployment_type" in deployment_data
        
        if is_old_format:
            # Handle old format
            # Get template
            template = db.query(Template).filter(Template.template_id == deployment_data["template_id"]).first()
            if not template:
                # Try to find the template by ID as a fallback
                template = db.query(Template).filter(Template.id == deployment_data["template_id"]).first()
                if not template:
                    raise HTTPException(
                        status_code=status.HTTP_404_NOT_FOUND,
                        detail=f"Template with ID {deployment_data['template_id']} not found"
                    )
            
            # Get environment
            environment = db.query(Environment).filter(Environment.id == deployment_data["environment_id"]).first()
            if not environment:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Environment with ID {deployment_data['environment_id']} not found"
                )
            
            # Get cloud account for the environment
            cloud_account = None
            if environment.cloud_accounts:
                # Get the first cloud account associated with this environment
                cloud_account = environment.cloud_accounts[0]
            
            # Get cloud settings if available
            cloud_settings = None
            if cloud_account and cloud_account.settings_id:
                cloud_settings = db.query(CloudSettings).filter(
                    CloudSettings.id == cloud_account.settings_id
                ).first()
            
            if not cloud_settings:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No cloud settings found for this environment"
                )
            
            # Determine location/region from parameters or use default
            location = "eastus"  # Default location
            if deployment_data.get("parameters"):
                if "location" in deployment_data["parameters"]:
                    location = deployment_data["parameters"]["location"]
                elif "region" in deployment_data["parameters"]:
                    location = deployment_data["parameters"]["region"]
            
            # Create sanitized resource group name
            sanitized_name = deployment_data["name"].lower().replace(' ', '-')
            # Remove any other special characters
            import re
            sanitized_name = re.sub(r'[^a-z0-9\-]', '', sanitized_name)
            resource_group = f"rg-{sanitized_name}"
            
            # Map to new format
            deployment_data = {
                "name": deployment_data["name"],
                "description": deployment_data.get("description", ""),
                "template_id": template.template_id,
                "environment": environment.name,
                "resource_group": resource_group,
                "location": location,
                "cloud_settings_id": cloud_settings.settings_id,
                "parameters": deployment_data.get("parameters", {})
            }
        else:
            # New format - validate required fields
            required_fields = ["name", "template_id", "environment", "resource_group", "location", "cloud_settings_id"]
            for field in required_fields:
                if field not in deployment_data:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"Missing required field: {field}"
                    )
            
            # For new format, we need to get the environment by name
            environment = db.query(Environment).filter(Environment.name == deployment_data["environment"]).first()
            if not environment:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Environment with name {deployment_data['environment']} not found"
                )
        
        # Get template
        template = db.query(Template).filter(Template.template_id == deployment_data["template_id"]).first()
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {deployment_data['template_id']} not found"
            )
        
        # Get cloud settings
        cloud_settings = db.query(CloudSettings).filter(
            CloudSettings.settings_id == deployment_data["cloud_settings_id"]
        ).first()
        
        if not cloud_settings:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Cloud settings with ID {deployment_data['cloud_settings_id']} not found"
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
        subscription_id = connection_details.get("subscription_id", "")
        
        if not client_id or not client_secret or not tenant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing required credentials in cloud settings"
            )
        
        # Generate deployment ID
        deployment_id = str(uuid.uuid4())
        
        # Create deployment in database
        db_deployment = Deployment(
            deployment_id=deployment_id,
            name=deployment_data["name"],
            description=deployment_data.get("description", ""),
            status="pending",
            template_id=template.id,  # Use the template's numeric ID for the database relationship
            environment_id=environment.id if is_old_format else None,  # Set environment_id if using old format
            tenant_id=current_user.tenant_id,
            created_by_id=current_user.id,
            parameters=deployment_data.get("parameters", {}),
            deployment_type=template.type.lower()  # Set deployment_type based on template type
        )
        
        db.add(db_deployment)
        db.flush()
        
        # Create deployment details
        db_deployment_details = DeploymentDetails(
            deployment_id=db_deployment.id,  # Use the numeric ID, not the UUID
            provider="azure",
            deployment_type=template.type.lower(),
            cloud_region=deployment_data["location"],
            status="pending",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        db.add(db_deployment_details)
        db.commit()
        
        # Forward request to deployment engine
        try:
            # Prepare request data for deployment engine
            deployment_engine_data = {
                "deployment_id": deployment_id,
                "name": deployment_data["name"],
                "type": template.type,
                "resource_group": deployment_data["resource_group"],
                "location": deployment_data["location"],
                "template_code": template.code,
                "parameters": deployment_data.get("parameters", {}),
                "credentials": {
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "tenant_id": tenant_id,
                    "subscription_id": subscription_id
                }
            }
            
            # Send request to deployment engine
            response = requests.post(
                f"{DEPLOYMENT_ENGINE_URL}/deployments",
                headers={"Authorization": f"Bearer {current_user.access_token}"},
                json=deployment_engine_data
            )
            
            if response.status_code != 200:
                # Update deployment status to failed
                db_deployment.status = "failed"
                db.commit()
                
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Error from deployment engine: {response.text}"
                )
            
            # Update deployment status to deploying
            db_deployment.status = "deploying"
            db.commit()
            
            # Return deployment details
            return {
                "id": deployment_id,
                "name": deployment_data["name"],
                "templateId": template.template_id,
                "templateName": template.name,
                "provider": template.provider,
                "status": "deploying",
                "environment": deployment_data["environment"],
                "createdAt": db_deployment.created_at.isoformat(),
                "updatedAt": db_deployment.updated_at.isoformat(),
                "parameters": deployment_data.get("parameters", {}),
                "resources": [],
                "tenantId": current_user.tenant_id,
                "region": deployment_data.get("location")
            }
        
        except Exception as e:
            # Update deployment status to failed
            db_deployment.status = "failed"
            db.commit()
            
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error creating deployment: {str(e)}"
            )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating deployment: {str(e)}"
        )


@router.put("/{deployment_id}", response_model=CloudDeploymentResponse)
def update_deployment(
    deployment_id: str,
    deployment_update: DeploymentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Update a deployment
    """
    # Check if user has permission to update deployments
    has_permission = any(p.name == "update:deployments" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Get the deployment
        result = db.query(
            Deployment, Template, Environment, Tenant
        ).join(
            Template, Deployment.template_id == Template.id
        ).join(
            Environment, Deployment.environment_id == Environment.id
        ).join(
            Tenant, Deployment.tenant_id == Tenant.tenant_id  # Join on tenant_id (UUID) instead of id (Integer)
        ).filter(
            Deployment.deployment_id == deployment_id
        ).first()
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Deployment with ID {deployment_id} not found"
            )
        
        deployment, template, environment, tenant = result
        
        # Check if user has access to this deployment's tenant
        if deployment.tenant_id != current_user.tenant_id:
            # Admin users can update all deployments
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to update this deployment"
                )
        
        # Update deployment
        deployment.name = deployment_update.name
        deployment.status = deployment_update.status
        deployment.parameters = deployment_update.parameters
        deployment.resources = deployment_update.resources
        deployment.region = deployment_update.region
        
        db.commit()
        db.refresh(deployment)
        
        # Return frontend-compatible response
        return CloudDeploymentResponse(
            id=deployment.deployment_id,
            name=deployment.name,
            templateId=template.template_id,
            templateName=template.name,
            provider=template.provider,
            status=deployment.status,
            environment=environment.name,
            createdAt=deployment.created_at.isoformat(),
            updatedAt=deployment.updated_at.isoformat(),
            parameters=deployment.parameters or {},
            resources=[],  # Default empty list if not available
            tenantId=tenant.tenant_id,
            region=deployment.region
        )
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating deployment: {str(e)}"
        )


@router.delete("/{deployment_id}")
def delete_deployment(
    deployment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Delete a deployment
    """
    # Check if user has permission to delete deployments
    has_permission = any(p.name == "delete:deployments" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Get the deployment
        deployment = db.query(Deployment).filter(Deployment.deployment_id == deployment_id).first()
        
        if not deployment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Deployment with ID {deployment_id} not found"
            )
        
        # Check if user has access to this deployment's tenant
        if deployment.tenant_id != current_user.tenant_id:
            # Admin users can delete all deployments
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to delete this deployment"
                )
        
        # Delete deployment
        db.delete(deployment)
        db.commit()
        
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting deployment: {str(e)}"
        )


@router.options("/")
def options_deployments():
    """
    Handle preflight requests for deployments
    """
    response = Response(status_code=200)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response


@router.options("/{deployment_id}")
def options_deployment_by_id():
    """
    Handle preflight requests for specific deployment
    """
    response = Response(status_code=200)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

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
    settings_id: str,
    tenant_id: Optional[str] = None
):
    """
    List available Azure subscriptions for a specific credential
    
    If tenant_id is provided, it will be used to filter the credentials.
    Otherwise, the current user's tenant ID will be used.
    """
    # Check if user has permission to view credentials
    if not current_user.role or "deployment:read" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    try:
        # Use the provided tenant_id if it exists, otherwise use the current user's tenant
        account_tenant_id = tenant_id if tenant_id else current_user.tenant.tenant_id
        
        # Check if tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == account_tenant_id).first()
        if not tenant:
            raise HTTPException(
                status_code=404,
                detail=f"Tenant with ID {account_tenant_id} not found"
            )
        
        # Check if user has permission to access this tenant
        if account_tenant_id != current_user.tenant.tenant_id:
            # Only admin or MSP users can access other tenants
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=403,
                    detail="Not authorized to access credentials for other tenants"
                )
        
        # Get credential from database
        creds = db.query(CloudSettings).filter(
            CloudSettings.tenant_id == account_tenant_id,
            CloudSettings.provider == "azure",
            CloudSettings.settings_id == settings_id
        ).first()
        
        if not creds:
            raise HTTPException(status_code=404, detail="Credential not found")
        
        # Forward request to deployment engine
        headers = {"Authorization": f"Bearer {current_user.access_token}"}
        
        # First set the credentials
        set_response = requests.post(
            f"{DEPLOYMENT_ENGINE_URL}/credentials",
            headers=headers,
            json={
                "client_id": creds.connection_details.get("client_id", "") if creds.connection_details else "",
                "client_secret": creds.connection_details.get("client_secret", "") if creds.connection_details else "",
                "tenant_id": creds.connection_details.get("tenant_id", "") if creds.connection_details else ""
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

@router.put("/engine/{deployment_id}/status", response_model=Dict[str, Any])
def update_deployment_status(
    deployment_id: str,
    update_data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Update deployment status from the deployment engine
    """
    # Set up logging for this endpoint
    import logging
    logger = logging.getLogger(__name__)
    logger.setLevel(logging.DEBUG)
    
    logger.debug(f"Received status update for deployment {deployment_id}")
    logger.debug(f"Update data: {json.dumps(update_data, default=str)}")
    logger.debug(f"User: {current_user.username} (ID: {current_user.id})")
    
    # Check if user has permission to update deployments
    has_permission = any(p.name == "update:deployments" for p in current_user.role.permissions)
    logger.debug(f"User has update:deployments permission: {has_permission}")
    
    if not has_permission:
        logger.warning(f"User {current_user.username} does not have permission to update deployments")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Find the deployment
        logger.debug(f"Looking for deployment with ID: {deployment_id}")
        deployment = db.query(Deployment).filter(Deployment.deployment_id == deployment_id).first()
        
        if not deployment:
            logger.warning(f"Deployment not found: {deployment_id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Deployment not found"
            )
        
        logger.debug(f"Found deployment: {deployment.name} (ID: {deployment.id}, DB ID: {deployment.deployment_id})")
        
        # Get or create deployment details
        logger.debug(f"Looking for deployment details for deployment ID: {deployment.id}")
        deployment_details = db.query(DeploymentDetails).filter(
            DeploymentDetails.deployment_id == deployment.id
        ).first()
        
        if not deployment_details:
            logger.debug(f"Creating new deployment details for deployment ID: {deployment.id}")
            deployment_details = DeploymentDetails(
                deployment_id=deployment.id,
                provider="azure",
                deployment_type=deployment.deployment_type if hasattr(deployment, 'deployment_type') else "arm",
                cloud_deployment_id=deployment.cloud_deployment_id if hasattr(deployment, 'cloud_deployment_id') else None,
                cloud_region=deployment.region,
                status="in_progress"
            )
            db.add(deployment_details)
            logger.debug(f"Added new deployment details to session")
        else:
            logger.debug(f"Found existing deployment details: {deployment_details.id}")
        
        # Update deployment status
        status_value = update_data.get("status")
        if status_value:
            logger.debug(f"Updating status to: {status_value}")
            deployment.status = status_value
            deployment_details.status = status_value
            
            # If deployment is complete, update completed_at
            if status_value in ["succeeded", "failed", "canceled"]:
                logger.debug(f"Deployment is complete with status: {status_value}, updating completed_at")
                deployment_details.completed_at = datetime.utcnow()
        
        # Update resources
        resources = update_data.get("resources")
        if resources:
            logger.debug(f"Updating resources: {len(resources)} resources")
            deployment_details.cloud_resources = resources
        
        # Update outputs
        outputs = update_data.get("outputs")
        if outputs:
            logger.debug(f"Updating outputs: {len(outputs)} outputs")
            deployment_details.outputs = outputs
        
        # Update logs
        logs = update_data.get("logs")
        if logs:
            logger.debug(f"Updating logs: {len(logs)} log entries")
            deployment_details.logs = logs
        
        # Add to deployment history
        logger.debug(f"Creating history entry for status: {status_value}")
        history_entry = DeploymentHistory(
            deployment_id=deployment.id,
            status=status_value,
            message=f"Deployment status updated to {status_value}",
            details={
                "resources": resources,
                "outputs": outputs,
                "logs": logs
            },
            user_id=current_user.id
        )
        db.add(history_entry)
        logger.debug(f"Added history entry to session")
        
        # Commit changes
        logger.debug("Committing changes to database")
        try:
            db.commit()
            logger.debug("Successfully committed changes to database")
        except Exception as commit_error:
            logger.error(f"Error committing to database: {str(commit_error)}")
            db.rollback()
            raise commit_error
        
        logger.debug(f"Status update for deployment {deployment_id} completed successfully")
        return {
            "message": "Deployment status updated successfully",
            "deployment_id": deployment_id,
            "status": status_value
        }
    
    except Exception as e:
        logger.error(f"Error updating deployment status: {str(e)}", exc_info=True)
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating deployment status: {str(e)}"
        )


@router.get("/{deployment_id}/logs", response_model=List[Dict[str, Any]])
def get_deployment_logs(
    deployment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get logs for a specific deployment from the deployment_history table
    """
    # Check if user has permission to view deployments
    has_permission = any(p.name == "view:deployments" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # First, get the deployment to check if it exists and if the user has access
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
        
        # Get logs from deployment_history table
        logs = db.query(DeploymentHistory).filter(
            DeploymentHistory.deployment_id == deployment.id
        ).order_by(DeploymentHistory.created_at.desc()).all()
        
        # Format logs for response
        formatted_logs = []
        for log in logs:
            formatted_logs.append({
                "id": log.id,
                "status": log.status,
                "message": log.message,
                "details": log.details,
                "timestamp": log.created_at.isoformat(),
                "user_id": log.user_id
            })
        
        return formatted_logs
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving deployment logs: {str(e)}"
        )

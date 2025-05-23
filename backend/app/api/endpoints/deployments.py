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
        headers = {"Authorization": f"Bearer {current_user.access_token}"}
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

@router.get("/azure_credentials", response_model=AzureCredentialsResponse)
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
        headers = {"Authorization": f"Bearer {current_user.access_token}"}
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
        
        # Filter by tenant
        if tenant_id:
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
        else:
            # Default to current user's tenant
            tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
            if tenant:
                query = query.filter(Tenant.tenant_id == tenant.tenant_id)
        
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
                resources=[],  # Default empty list if not available
                tenantId=tenant.tenant_id,
                region=region
            ))
        
        return deployments
    
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
) -> Any:
    """
    Get a specific deployment by ID
    """
    # Check if user has permission to view deployments
    has_permission = any(p.name == "view:deployments" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
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
            # Admin users can view all deployments
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to access this deployment"
                )
        
        # Convert to frontend-compatible format
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
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving deployment: {str(e)}"
        )


@router.post("/", response_model=CloudDeploymentResponse)
def create_deployment(
    deployment: DeploymentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Create a new deployment
    """
    # Check if user has permission to create deployments
    has_permission = any(p.name == "create:deployments" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Verify template exists
        template = db.query(Template).filter(Template.id == deployment.template_id).first()
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Template with ID {deployment.template_id} not found"
            )
        
        # Verify environment exists
        environment = db.query(Environment).filter(Environment.id == deployment.environment_id).first()
        if not environment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Environment with ID {deployment.environment_id} not found"
            )
        
        # Get tenant for response
        tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
        
        # Create new deployment
        import uuid
        new_deployment = Deployment(
            deployment_id=str(uuid.uuid4()),
            name=deployment.name,
            description=deployment.description,
            status="pending",  # Default status for new deployments
            template_id=deployment.template_id,
            environment_id=deployment.environment_id,
            tenant_id=tenant.tenant_id,  # Use tenant_id (UUID) instead of id (Integer)
            created_by_id=current_user.id,
            parameters=deployment.parameters
        )
        
        db.add(new_deployment)
        db.commit()
        db.refresh(new_deployment)
        
        # Extract region from parameters if available
        region = None
        if new_deployment.parameters and "region" in new_deployment.parameters:
            region = new_deployment.parameters["region"]
        
        # Return frontend-compatible response
        return CloudDeploymentResponse(
            id=new_deployment.deployment_id,
            name=new_deployment.name,
            templateId=template.template_id,
            templateName=template.name,
            provider=template.provider,
            status=new_deployment.status,
            environment=environment.name,
            createdAt=new_deployment.created_at.isoformat(),
            updatedAt=new_deployment.updated_at.isoformat(),
            parameters=new_deployment.parameters or {},
            resources=[],  # Default empty list for new deployments
            tenantId=tenant.tenant_id,
            region=region
        )
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
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
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
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

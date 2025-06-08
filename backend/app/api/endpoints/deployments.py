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

import logging

# Set up logging for this endpoint
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

from app.db.session import get_db
from app.api.endpoints.auth import get_current_user
from app.models.user import User, Tenant
from app.models.deployment import Deployment, DeploymentHistory, Template, Environment, CloudAccount
from app.models.deployment_details import DeploymentDetails
from app.models.cloud_settings import CloudSettings
from app.schemas.deployment import (
    DeploymentResponse, DeploymentCreate, DeploymentUpdate,
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

# Azure Subscription Schemas
class AzureSubscriptionResponse(BaseModel):
    id: str
    name: str
    state: str
    tenant_id: str

@router.get("/azure_credentials", tags=["azure-credentials"], response_model=List[AzureCredentialsResponse])
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
    if not current_user.role or "list:deployments" not in [p.name for p in current_user.role.permissions]:
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
        
        # Prepare parameters for the deployment engine
        params = {}
        
        # If accessing a different tenant, pass target_tenant_id
        if creds_tenant_id != current_user.tenant.tenant_id:
            params["target_tenant_id"] = creds_tenant_id
        
        response = requests.get(
            f"{DEPLOYMENT_ENGINE_URL}/credentials",
            headers=headers,
            params=params
        )
        
        engine_status = {"configured": False, "message": "Unknown status"}
        if response.status_code == 200:
            engine_status = response.json()
        else:
            # If deployment engine returns an error, still show the credentials from database
            logger.warning(f"Deployment engine credentials check failed: {response.text}")
            engine_status = {"configured": True, "message": "Credentials managed in database"}
        
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

@router.post("/azure_credentials", tags=["azure-credentials"], response_model=Dict[str, str])
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
    if not current_user.role or "manage:deployments" not in [p.name for p in current_user.role.permissions]:
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

@router.get("/azure_credentials/{settings_id}", tags=["azure-credentials"], response_model=AzureCredentialsResponse)
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
    if not current_user.role or "list:deployments" not in [p.name for p in current_user.role.permissions]:
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
        
        # Prepare parameters for the deployment engine
        params = {"settings_id": settings_id}
        
        # If accessing a different tenant, pass target_tenant_id
        if creds_tenant_id != current_user.tenant.tenant_id:
            params["target_tenant_id"] = creds_tenant_id
        
        response = requests.get(
            f"{DEPLOYMENT_ENGINE_URL}/credentials",
            headers=headers,
            params=params
        )
        
        engine_status = {"configured": False, "message": "Unknown status"}
        if response.status_code == 200:
            engine_status = response.json()
        else:
            # If deployment engine returns an error, still show the credentials from database
            logger.warning(f"Deployment engine credentials check failed: {response.text}")
            engine_status = {"configured": True, "message": "Credentials managed in database"}
        
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

@router.delete("/azure_credentials/{settings_id}", tags=["azure-credentials"], response_model=Dict[str, str])
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
    if not current_user.role or "manage:deployments" not in [p.name for p in current_user.role.permissions]:
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

@router.put("/engine/{deployment_id}/status", tags=["deployment-engine"], response_model=Dict[str, Any])
def update_deployment_status(
    deployment_id: str,
    update_data: Dict[str, Any],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Update deployment status from the deployment engine
    """
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
            
            # Create cloud_properties object with available data
            cloud_properties = {}
            if hasattr(deployment, 'region') and deployment.region:
                cloud_properties['location'] = deployment.region
            
            deployment_details = DeploymentDetails(
                deployment_id=deployment.id,
                provider="azure",
                deployment_type=deployment.deployment_type if hasattr(deployment, 'deployment_type') else "arm",
                cloud_deployment_id=deployment.cloud_deployment_id if hasattr(deployment, 'cloud_deployment_id') else None,
                cloud_properties=cloud_properties if cloud_properties else None,
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
                "logs": logs,
                "deployment_result": update_data.get("deployment_result", {})  # Store the deployment result
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

@router.get("/azure_credentials/{settings_id}/subscriptions", tags=["azure-credentials"], response_model=List[AzureSubscriptionResponse])
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
    if not current_user.role or "list:deployments" not in [p.name for p in current_user.role.permissions]:
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
        
        # Forward request to deployment engine with settings_id parameter
        headers = {"Authorization": f"Bearer {current_user.access_token}"}
        
        # Prepare parameters for the deployment engine
        params = {"settings_id": settings_id}
        
        # If accessing a different tenant, pass target_tenant_id
        if account_tenant_id != current_user.tenant.tenant_id:
            params["target_tenant_id"] = account_tenant_id
        
        # Call the subscriptions endpoint with parameters
        response = requests.get(
            f"{DEPLOYMENT_ENGINE_URL}/credentials/subscriptions",
            headers=headers,
            params=params
        )
        
        if response.status_code != 200:
            logger.error(f"Error listing subscriptions from deployment engine: {response.text}")
            
            # Try to parse the error response
            try:
                error_data = response.json()
                error_message = error_data.get("detail", response.text)
            except:
                error_message = response.text
            
            # Return a more user-friendly error response
            raise HTTPException(
                status_code=response.status_code,
                detail=f"Failed to list Azure subscriptions: {error_message}"
            )
        
        return response.json()
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", tags=["deployments"], response_model=List[CloudDeploymentResponse])
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
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    
    # Check if user has permission to view deployments
    has_permission = any(p.name == "list:deployments" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions to list deployments"
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
                templateVersion=getattr(deployment, 'template_version', None),  # Safely get template_version if it exists
                provider=provider,
                status=deployment.status,
                environment=environment.name,
                createdAt=deployment.created_at.isoformat(),
                updatedAt=deployment.updated_at.isoformat(),
                parameters=deployment.parameters or {},
                resources=resources,  # Use resources from deployment_details
                tenantId=tenant.tenant_id,
                region=region,
                details={
                    "outputs": deployment_details.outputs if deployment_details else {}
                } if deployment_details else None
            ))
        
        return deployments
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving deployments: {str(e)}"
        )

@router.get("/{deployment_id}", tags=["deployments"], response_model=CloudDeploymentResponse)
def get_deployment(
    deployment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get a specific deployment by ID
    """
    # Check if user has permission to view deployments
    has_permission = any(p.name == "list:deployments" for p in current_user.role.permissions)
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
        
        # Get deployment details if available
        deployment_details = db.query(DeploymentDetails).filter(
            DeploymentDetails.deployment_id == deployment.id
        ).first()
        
        # Get resources from deployment details
        resources = []
        if deployment_details and deployment_details.cloud_resources:
            resources = deployment_details.cloud_resources
        
        # Convert to frontend-compatible format
        return CloudDeploymentResponse(
            id=deployment.deployment_id,
            name=deployment.name,
            templateId=template.template_id,
            templateName=template.name,
            templateVersion=deployment.template_version,  # Add template version
            provider=deployment.deployment_type,
            status=deployment.status,
            environment=environment.name,
            createdAt=deployment.created_at.isoformat(),
            updatedAt=deployment.updated_at.isoformat(),
            parameters=deployment.parameters or {},
            resources=resources,
            tenantId=tenant.tenant_id,
            region=deployment.region,
            details={
                "outputs": deployment_details.outputs if deployment_details else {}
            } if deployment_details else None
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving deployment: {str(e)}"
        )

@router.post("/", tags=["deployments"], response_model=CloudDeploymentResponse)
def create_deployment(
    deployment: DeploymentCreate,
    tenant_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Create a new deployment
    
    If tenant_id is provided in the query string, it will be used instead of the current user's tenant_id.
    """
    # Check if user has permission to create deployments
    has_permission = any(p.name == "create:deployments" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Debug: Print the deployment data
        print(f"Deployment data received: {deployment.dict()}")
        print(f"Query param tenant_id: {tenant_id}")
        
        # Verify template exists
        print(f"Looking for template with template_id: {deployment.template_id}")
        template = db.query(Template).filter(Template.template_id == deployment.template_id).first()
        if not template:
            # Try to find the template by ID as a fallback
            print(f"Template not found by template_id, trying to find by id")
            template = db.query(Template).filter(Template.id == deployment.template_id).first()
            if not template:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Template with ID {deployment.template_id} not found"
                )
            print(f"Template found by id: {template.id}, template_id: {template.template_id}")
        else:
            print(f"Template found by template_id: {template.template_id}, id: {template.id}")
        
        # Verify environment exists
        environment = db.query(Environment).filter(Environment.id == deployment.environment_id).first()
        if not environment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Environment with ID {deployment.environment_id} not found"
            )
        
        # Determine which tenant_id to use
        deployment_tenant_id = current_user.tenant_id
        if tenant_id:
            # Verify the tenant exists and user has access to it
            tenant_obj = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
            if not tenant_obj:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Tenant with ID {tenant_id} not found"
                )
            
            # Check if user has access to this tenant
            if tenant_id != current_user.tenant_id:
                # Only admin or MSP users can create deployments for other tenants
                if current_user.role.name != "admin" and current_user.role.name != "msp":
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Not authorized to create deployments for other tenants"
                    )
            
            deployment_tenant_id = tenant_id
            print(f"Using tenant_id from query parameter: {deployment_tenant_id}")
        else:
            print(f"Using current user's tenant_id: {deployment_tenant_id}")
        
        # Get tenant for response
        tenant = db.query(Tenant).filter(Tenant.tenant_id == deployment_tenant_id).first()
        
        # Create new deployment
        import uuid
        new_deployment = Deployment(
            deployment_id=str(uuid.uuid4()),
            name=deployment.name,
            description=deployment.description,
            status="pending",  # Default status for new deployments
            template_id=template.id,  # Use the template's numeric ID for the database relationship
            environment_id=deployment.environment_id,
            tenant_id=tenant.tenant_id,  # Use tenant_id (UUID) instead of id (Integer)
            created_by_id=current_user.id,
            parameters=deployment.parameters,
            deployment_type=template.type.lower(),  # Set deployment_type based on template type
            template_version=template.current_version  # Store the template version
        )
        
        db.add(new_deployment)
        db.commit()
        db.refresh(new_deployment)
        
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
        
        # Forward deployment to deployment engine
        try:
            # Determine location/region from parameters or use default
            location = "eastus"  # Default location
            if deployment.parameters:
                if "location" in deployment.parameters:
                    location = deployment.parameters["location"]
                elif "region" in deployment.parameters:
                    location = deployment.parameters["region"]
            
            # Use location from deployment request if provided, otherwise use the determined location
            if deployment.location:
                location = deployment.location
            
            # Determine resource group - use provided value or generate default
            resource_group = deployment.resource_group
            if not resource_group:
                resource_group = f"rg-{new_deployment.name.lower().replace(' ', '-')}"
            
            # Ensure template_code is a string and not empty
            template_code = template.code if template.code else ""
            
            # Create deployment engine request
            engine_deployment = {
                "deployment_id": new_deployment.deployment_id,  # Pass the backend-generated deployment ID
                "name": new_deployment.name,
                "description": new_deployment.description,
                "deployment_type": template.type.lower(),  # Use template type (terraform, arm, etc.)
                "resource_group": resource_group,
                "location": location,
                "template": {
                    "source": "code",
                    "code": template_code
                },
                "parameters": new_deployment.parameters if new_deployment.parameters else {}
            }
            
            # Debug: Log that we're passing the deployment ID to the engine
            print(f"Passing deployment_id to engine: {new_deployment.deployment_id}")
            
            # Add cloud account details if available
            if cloud_account:
                engine_deployment["subscription_id"] = cloud_account.cloud_ids[0] if cloud_account.cloud_ids else None
            
            # Add cloud settings (credentials) if available
            if cloud_settings:
                engine_deployment["settings_id"] = str(cloud_settings.settings_id)
                # Extract credentials from connection_details
                if cloud_settings.connection_details:
                    print(f"Connection details structure: {json.dumps(cloud_settings.connection_details, default=str)}")
                    
                    # Handle both string and dict formats for connection_details
                    if isinstance(cloud_settings.connection_details, str):
                        # Parse JSON string
                        connection_details = json.loads(cloud_settings.connection_details)
                        print(f"Parsed connection details from string: {json.dumps(connection_details, default=str)}")
                    else:
                        # Already a dict
                        connection_details = cloud_settings.connection_details
                    
                    # Extract credentials from the connection_details
                    engine_deployment["client_id"] = connection_details.get("client_id", "")
                    engine_deployment["client_secret"] = connection_details.get("client_secret", "")
                    engine_deployment["tenant_id"] = connection_details.get("tenant_id", "")
                    engine_deployment["subscription_id"] = connection_details.get("subscription_id", "")
                    
                    # Debug log for credentials
                    print(f"Extracted credentials from connection_details: client_id={engine_deployment['client_id'] != ''}, client_secret={engine_deployment['client_secret'] != ''}, tenant_id={engine_deployment['tenant_id'] != ''}, subscription_id={engine_deployment.get('subscription_id', '') != ''}")
            else:
                print("No cloud_settings found for this deployment")
            
            # Debug: Print engine deployment data (redact sensitive info)
            debug_data = engine_deployment.copy()
            if "client_secret" in debug_data:
                debug_data["client_secret"] = "***REDACTED***"
            print(f"Engine deployment data: {debug_data}")
            
            # Send to deployment engine
            headers = {"Authorization": f"Bearer {current_user.access_token}"}
            params = {}
            # If deploying to a different tenant, pass target_tenant_id
            if deployment_tenant_id != current_user.tenant_id:
                params["target_tenant_id"] = deployment_tenant_id
            
            response = requests.post(
                f"{DEPLOYMENT_ENGINE_URL}/deployments",
                headers=headers,
                json=engine_deployment,
                params=params
            )
            
            # Debug: Print deployment engine response
            print(f"Deployment engine response status: {response.status_code}")
            print(f"Deployment engine response: {response.text}")
            
            if response.status_code != 200:
                # Log the error but don't fail the deployment creation
                print(f"Deployment engine error: {response.text}")
                # Update deployment status to reflect the error
                new_deployment.status = "failed"
                db.commit()
            else:
                # Update deployment with engine response
                engine_result = response.json()
                new_deployment.status = engine_result.get("status", "pending")
                
                # Store the Azure deployment ID in the cloud_deployment_id field
                if "azure_deployment_id" in engine_result:
                    new_deployment.cloud_deployment_id = engine_result["azure_deployment_id"]
                    print(f"Stored Azure deployment ID: {engine_result['azure_deployment_id']}")
                
                db.commit()
        except Exception as e:
            # Log the error but don't fail the deployment creation
            print(f"Error forwarding to deployment engine: {str(e)}")
            # Update deployment status to reflect the error
            new_deployment.status = "failed"
            db.commit()
        
        # Extract region from parameters if available
        region = None
        if new_deployment.parameters:
            if "region" in new_deployment.parameters:
                region = new_deployment.parameters["region"]
            elif "location" in new_deployment.parameters:
                region = new_deployment.parameters["location"]
        
        # Create deployment details record
        deployment_details = db.query(DeploymentDetails).filter(
            DeploymentDetails.deployment_id == new_deployment.id
        ).first()
        
        if not deployment_details:
            # Create cloud_properties object with location and resource_group
            cloud_properties = {}
            if location:
                cloud_properties['location'] = location
            if resource_group:
                cloud_properties['resource_group'] = resource_group
            
            deployment_details = DeploymentDetails(
                deployment_id=new_deployment.id,
                provider=template.provider,
                deployment_type=new_deployment.deployment_type,
                cloud_deployment_id=new_deployment.cloud_deployment_id,
                cloud_properties=cloud_properties if cloud_properties else None,
                status=new_deployment.status
            )
            db.add(deployment_details)
            db.commit()
        
        # Return frontend-compatible response
        return CloudDeploymentResponse(
            id=new_deployment.deployment_id,
            name=new_deployment.name,
            templateId=template.template_id,
            templateName=template.name,
            templateVersion=deployment.template_version,  # Add template version
            provider=template.provider,
            status=new_deployment.status,
            environment=environment.name,
            createdAt=new_deployment.created_at.isoformat(),
            updatedAt=new_deployment.updated_at.isoformat(),
            parameters=new_deployment.parameters or {},
            resources=[],  # Default empty list for new deployments
            tenantId=tenant.tenant_id,
            region=region,
            details={
                "outputs": deployment_details.outputs if deployment_details else {}
            } if deployment_details else None
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

@router.put("/{deployment_id}", tags=["deployments"], response_model=CloudDeploymentResponse)
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
            templateVersion=deployment.template_version,  # Add template version
            provider=template.provider,
            status=deployment.status,
            environment=environment.name,
            createdAt=deployment.created_at.isoformat(),
            updatedAt=deployment.updated_at.isoformat(),
            parameters=deployment.parameters or {},
            resources=[],  # Default empty list if not available
            tenantId=tenant.tenant_id,
            region=deployment.region,
            details={
                "outputs": deployment_details.outputs if deployment_details else {}
            } if deployment_details else None
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

@router.delete("/{deployment_id}", tags=["deployments"])
def delete_deployment(
    deployment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Delete a deployment and all related records
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
        
        # Delete related records in the correct order to maintain referential integrity
        
        # 1. Delete deployment history records
        deployment_history_records = db.query(DeploymentHistory).filter(
            DeploymentHistory.deployment_id == deployment.id
        ).all()
        
        for history_record in deployment_history_records:
            db.delete(history_record)
        
        # 2. Delete deployment details records
        deployment_details_records = db.query(DeploymentDetails).filter(
            DeploymentDetails.deployment_id == deployment.id
        ).all()
        
        for details_record in deployment_details_records:
            db.delete(details_record)
        
        # 3. Finally delete the main deployment record
        db.delete(deployment)
        
        # Commit all deletions in a single transaction
        db.commit()
        
        logger.info(f"Successfully deleted deployment {deployment_id} and all related records")
        
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"Error deleting deployment {deployment_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting deployment: {str(e)}"
        )

@router.options("/", tags=["deployments"])
def options_deployments():
    """
    Handle preflight requests for deployments
    """
    response = Response(status_code=200)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

@router.options("/{deployment_id}", tags=["deployments"])
def options_deployment_by_id():
    """
    Handle preflight requests for specific deployment
    """
    response = Response(status_code=200)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

@router.get("/{deployment_id}/logs", tags=["deployments"], response_model=List[Dict[str, Any]])
def get_deployment_logs(
    deployment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get logs for a specific deployment from the deployment_history table
    """
    # Check if user has permission to view deployments
    has_permission = any(p.name == "list:deployments" for p in current_user.role.permissions)
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

from fastapi import APIRouter, Depends, HTTPException, Body, Query, Path
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import requests
import os
from datetime import datetime

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.models.deployment import Deployment, DeploymentHistory
from app.models.deployment_details import DeploymentDetails
from app.schemas.deployment import (
    DeploymentCreate, 
    DeploymentUpdate, 
    DeploymentResponse,
    DeploymentDetailResponse
)

router = APIRouter()

# Deployment engine API URL
DEPLOYMENT_ENGINE_URL = os.getenv("DEPLOYMENT_ENGINE_URL", "http://deployment-engine:5000")

@router.post("/", response_model=DeploymentResponse)
def create_deployment(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    deployment_in: DeploymentCreate
):
    """
    Create a new deployment using the deployment engine.
    """
    # Check if user has permission to create deployments
    if not current_user.role or "deployment:create" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Create deployment record in database
    db_deployment = Deployment(
        name=deployment_in.name,
        description=deployment_in.description,
        status="pending",
        parameters=deployment_in.parameters,
        tenant_id=current_user.tenant_id,
        environment_id=deployment_in.environment_id,
        template_id=deployment_in.template_id,
        created_by_id=current_user.id
    )
    db.add(db_deployment)
    db.flush()
    
    # Create deployment history record
    history = DeploymentHistory(
        deployment_id=db_deployment.id,
        status="pending",
        message="Deployment initiated",
        user_id=current_user.id
    )
    db.add(history)
    
    # Create deployment details record
    details = DeploymentDetails(
        deployment_id=db_deployment.id,
        status="pending",
        provider=deployment_in.provider,
        deployment_type=deployment_in.deployment_type,
        template_source=deployment_in.template_source,
        template_url=deployment_in.template_url
    )
    db.add(details)
    db.commit()
    db.refresh(db_deployment)
    
    try:
        # Prepare request to deployment engine
        headers = {"Authorization": f"Bearer {get_token_for_deployment_engine(current_user)}"}
        
        # Prepare template data
        template_data = {
            "source": deployment_in.template_source
        }
        
        if deployment_in.template_source == "url":
            template_data["url"] = deployment_in.template_url
        else:
            template_data["code"] = deployment_in.template_code
        
        # Prepare request body
        request_data = {
            "name": deployment_in.name,
            "description": deployment_in.description,
            "provider": deployment_in.provider,
            "deployment_type": deployment_in.deployment_type,
            "environment": deployment_in.environment_name,
            "template": template_data,
            "parameters": deployment_in.parameters
        }
        
        # Add project_id for GCP deployments
        if deployment_in.provider == "gcp" and deployment_in.project_id:
            request_data["project_id"] = deployment_in.project_id
        
        # Send request to deployment engine
        response = requests.post(
            f"{DEPLOYMENT_ENGINE_URL}/deployments",
            headers=headers,
            json=request_data
        )
        
        if response.status_code != 200:
            raise Exception(f"Deployment engine error: {response.text}")
        
        result = response.json()
        
        # Update deployment details with cloud deployment ID
        details.cloud_deployment_id = result.get("cloud_deployment_id")
        details.status = result.get("status", "pending")
        db.commit()
        
        return {
            "id": db_deployment.id,
            "deployment_id": db_deployment.deployment_id,
            "name": db_deployment.name,
            "status": details.status,
            "created_at": db_deployment.created_at,
            "updated_at": db_deployment.updated_at,
            "cloud_deployment_id": details.cloud_deployment_id
        }
        
    except Exception as e:
        # Update deployment status to failed
        db_deployment.status = "failed"
        details.status = "failed"
        details.error_details = {"message": str(e)}
        
        # Add error to history
        history = DeploymentHistory(
            deployment_id=db_deployment.id,
            status="failed",
            message=f"Deployment failed: {str(e)}",
            user_id=current_user.id
        )
        db.add(history)
        db.commit()
        
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/", response_model=List[DeploymentResponse])
def list_deployments(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    skip: int = 0,
    limit: int = 100,
    provider: Optional[str] = None,
    status: Optional[str] = None
):
    """
    List deployments with optional filtering.
    """
    # Check if user has permission to view deployments
    if not current_user.role or "deployment:read" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Build query
    query = db.query(Deployment).filter(Deployment.tenant_id == current_user.tenant_id)
    
    if provider:
        query = query.join(DeploymentDetails).filter(DeploymentDetails.provider == provider)
    
    if status:
        query = query.join(DeploymentDetails, isouter=True).filter(DeploymentDetails.status == status)
    
    # Apply pagination
    deployments = query.offset(skip).limit(limit).all()
    
    # Format response
    result = []
    for deployment in deployments:
        details = db.query(DeploymentDetails).filter(DeploymentDetails.deployment_id == deployment.id).first()
        
        result.append({
            "id": deployment.id,
            "deployment_id": deployment.deployment_id,
            "name": deployment.name,
            "status": details.status if details else "unknown",
            "created_at": deployment.created_at,
            "updated_at": deployment.updated_at,
            "cloud_deployment_id": details.cloud_deployment_id if details else None
        })
    
    return result

@router.get("/{deployment_id}", response_model=DeploymentDetailResponse)
def get_deployment(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    deployment_id: str
):
    """
    Get detailed information about a deployment.
    """
    # Check if user has permission to view deployments
    if not current_user.role or "deployment:read" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Get deployment from database
    deployment = db.query(Deployment).filter(
        Deployment.deployment_id == deployment_id,
        Deployment.tenant_id == current_user.tenant_id
    ).first()
    
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    
    # Get deployment details
    details = db.query(DeploymentDetails).filter(DeploymentDetails.deployment_id == deployment.id).first()
    
    if not details:
        raise HTTPException(status_code=404, detail="Deployment details not found")
    
    # If deployment is in progress, check status from deployment engine
    if details.status in ["pending", "in_progress"]:
        try:
            # Prepare request to deployment engine
            headers = {"Authorization": f"Bearer {get_token_for_deployment_engine(current_user)}"}
            
            # Send request to deployment engine
            response = requests.get(
                f"{DEPLOYMENT_ENGINE_URL}/deployments/{details.cloud_deployment_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                result = response.json()
                
                # Update deployment details
                details.status = result.get("status", details.status)
                details.cloud_resources = result.get("cloud_resources", details.cloud_resources)
                details.outputs = result.get("outputs", details.outputs)
                details.logs = result.get("logs", details.logs)
                details.error_details = result.get("error_details", details.error_details)
                details.updated_at = datetime.utcnow()
                
                if result.get("status") == "completed" and not details.completed_at:
                    details.completed_at = datetime.utcnow()
                    
                    # Add completion to history
                    history = DeploymentHistory(
                        deployment_id=deployment.id,
                        status="completed",
                        message="Deployment completed successfully",
                        user_id=current_user.id
                    )
                    db.add(history)
                
                elif result.get("status") == "failed" and details.status != "failed":
                    # Add failure to history
                    history = DeploymentHistory(
                        deployment_id=deployment.id,
                        status="failed",
                        message=f"Deployment failed: {result.get('error_details', {}).get('message', 'Unknown error')}",
                        user_id=current_user.id
                    )
                    db.add(history)
                
                db.commit()
        
        except Exception as e:
            # Log the error but don't update the deployment status
            print(f"Error checking deployment status: {e}")
    
    # Get deployment history
    history = db.query(DeploymentHistory).filter(
        DeploymentHistory.deployment_id == deployment.id
    ).order_by(DeploymentHistory.created_at.desc()).all()
    
    # Format response
    return {
        "id": deployment.id,
        "deployment_id": deployment.deployment_id,
        "name": deployment.name,
        "description": deployment.description,
        "status": details.status,
        "provider": details.provider,
        "deployment_type": details.deployment_type,
        "template_source": details.template_source,
        "template_url": details.template_url,
        "cloud_deployment_id": details.cloud_deployment_id,
        "cloud_region": details.cloud_region,
        "cloud_resources": details.cloud_resources,
        "outputs": details.outputs,
        "logs": details.logs,
        "error_details": details.error_details,
        "created_at": deployment.created_at,
        "updated_at": details.updated_at,
        "completed_at": details.completed_at,
        "history": [
            {
                "status": h.status,
                "message": h.message,
                "created_at": h.created_at,
                "user": {
                    "id": h.user.id,
                    "username": h.user.username
                } if h.user else None
            } for h in history
        ]
    }

@router.put("/{deployment_id}", response_model=DeploymentResponse)
def update_deployment(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    deployment_id: str,
    deployment_in: DeploymentUpdate
):
    """
    Update an existing deployment.
    """
    # Check if user has permission to update deployments
    if not current_user.role or "deployment:update" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Get deployment from database
    deployment = db.query(Deployment).filter(
        Deployment.deployment_id == deployment_id,
        Deployment.tenant_id == current_user.tenant_id
    ).first()
    
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    
    # Get deployment details
    details = db.query(DeploymentDetails).filter(DeploymentDetails.deployment_id == deployment.id).first()
    
    if not details:
        raise HTTPException(status_code=404, detail="Deployment details not found")
    
    # Check if deployment can be updated
    if details.status == "failed":
        raise HTTPException(status_code=400, detail="Failed deployments cannot be updated")
    
    try:
        # Prepare request to deployment engine
        headers = {"Authorization": f"Bearer {get_token_for_deployment_engine(current_user)}"}
        
        # Prepare template data if provided
        request_data = {}
        
        if deployment_in.template_source and (deployment_in.template_url or deployment_in.template_code):
            template_data = {
                "source": deployment_in.template_source
            }
            
            if deployment_in.template_source == "url":
                template_data["url"] = deployment_in.template_url
            else:
                template_data["code"] = deployment_in.template_code
                
            request_data["template"] = template_data
        
        # Add parameters if provided
        if deployment_in.parameters:
            request_data["parameters"] = deployment_in.parameters
        
        # Send request to deployment engine
        response = requests.put(
            f"{DEPLOYMENT_ENGINE_URL}/deployments/{details.cloud_deployment_id}",
            headers=headers,
            json=request_data
        )
        
        if response.status_code != 200:
            raise Exception(f"Deployment engine error: {response.text}")
        
        result = response.json()
        
        # Update deployment details
        details.status = result.get("status", "in_progress")
        details.updated_at = datetime.utcnow()
        
        # Add update to history
        history = DeploymentHistory(
            deployment_id=deployment.id,
            status="in_progress",
            message="Deployment update initiated",
            user_id=current_user.id
        )
        db.add(history)
        db.commit()
        
        return {
            "id": deployment.id,
            "deployment_id": deployment.deployment_id,
            "name": deployment.name,
            "status": details.status,
            "created_at": deployment.created_at,
            "updated_at": details.updated_at,
            "cloud_deployment_id": details.cloud_deployment_id
        }
        
    except Exception as e:
        # Update deployment status to failed
        details.status = "failed"
        details.error_details = {"message": str(e)}
        details.updated_at = datetime.utcnow()
        
        # Add error to history
        history = DeploymentHistory(
            deployment_id=deployment.id,
            status="failed",
            message=f"Deployment update failed: {str(e)}",
            user_id=current_user.id
        )
        db.add(history)
        db.commit()
        
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{deployment_id}", response_model=DeploymentResponse)
def delete_deployment(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    deployment_id: str
):
    """
    Delete a deployment.
    """
    # Check if user has permission to delete deployments
    if not current_user.role or "deployment:delete" not in [p.name for p in current_user.role.permissions]:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    # Get deployment from database
    deployment = db.query(Deployment).filter(
        Deployment.deployment_id == deployment_id,
        Deployment.tenant_id == current_user.tenant_id
    ).first()
    
    if not deployment:
        raise HTTPException(status_code=404, detail="Deployment not found")
    
    # Get deployment details
    details = db.query(DeploymentDetails).filter(DeploymentDetails.deployment_id == deployment.id).first()
    
    if not details:
        raise HTTPException(status_code=404, detail="Deployment details not found")
    
    try:
        # Prepare request to deployment engine
        headers = {"Authorization": f"Bearer {get_token_for_deployment_engine(current_user)}"}
        
        # Send request to deployment engine
        response = requests.delete(
            f"{DEPLOYMENT_ENGINE_URL}/deployments/{details.cloud_deployment_id}",
            headers=headers
        )
        
        if response.status_code != 200:
            raise Exception(f"Deployment engine error: {response.text}")
        
        result = response.json()
        
        # Update deployment details
        details.status = "in_progress"  # Set to in_progress for deletion
        details.updated_at = datetime.utcnow()
        
        # Add deletion to history
        history = DeploymentHistory(
            deployment_id=deployment.id,
            status="in_progress",
            message="Deployment deletion initiated",
            user_id=current_user.id
        )
        db.add(history)
        db.commit()
        
        return {
            "id": deployment.id,
            "deployment_id": deployment.deployment_id,
            "name": deployment.name,
            "status": details.status,
            "created_at": deployment.created_at,
            "updated_at": details.updated_at,
            "cloud_deployment_id": details.cloud_deployment_id
        }
        
    except Exception as e:
        # Update deployment status to failed
        details.status = "failed"
        details.error_details = {"message": str(e)}
        details.updated_at = datetime.utcnow()
        
        # Add error to history
        history = DeploymentHistory(
            deployment_id=deployment.id,
            status="failed",
            message=f"Deployment deletion failed: {str(e)}",
            user_id=current_user.id
        )
        db.add(history)
        db.commit()
        
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


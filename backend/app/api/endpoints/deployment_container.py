from typing import Any, List, Optional, Dict, Union
from fastapi import APIRouter, Depends, HTTPException, status, Response, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field, validator
import uuid
from datetime import datetime

from app.api.deps import get_db, get_current_user
from app.models.user import User
from app.models.deployment_details import DeploymentDetails
from app.models.cloud_account import CloudAccount
from app.models.template import Template
from app.models.environment import Environment
from app.utils.error_handling import format_error_response

router = APIRouter()

# Schema definitions
class DeploymentBase(BaseModel):
    name: str
    description: Optional[str] = None
    provider: str  # azure, aws, gcp
    cloud_account_id: str
    environment_id: str
    template_type: str  # terraform, arm, cloudformation, etc.
    is_dry_run: Optional[bool] = False
    auto_approve: Optional[bool] = False
    parameters: Optional[Dict[str, Any]] = None
    variables: Optional[Dict[str, Any]] = None

class DeploymentCreateWithTemplateId(DeploymentBase):
    template_id: str

class DeploymentCreateWithTemplateUrl(DeploymentBase):
    template_url: str

class DeploymentCreateWithTemplateCode(DeploymentBase):
    template_code: str

class DeploymentUpdate(BaseModel):
    status: Optional[str] = None
    outputs: Optional[Dict[str, Any]] = None
    resources: Optional[Dict[str, Any]] = None
    logs: Optional[str] = None
    error_message: Optional[str] = None
    error_details: Optional[Dict[str, Any]] = None
    completed_at: Optional[datetime] = None

class DeploymentResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    status: str
    provider: str
    cloud_account: Dict[str, Any]
    environment: Dict[str, Any]
    template_type: str
    parameters: Optional[Dict[str, Any]] = None
    variables: Optional[Dict[str, Any]] = None
    outputs: Optional[Dict[str, Any]] = None
    resources: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    is_dry_run: bool
    auto_approve: bool
    error_message: Optional[str] = None

    class Config:
        orm_mode = True

@router.post("/deployments/template-id", response_model=DeploymentResponse)
def create_deployment_with_template_id(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    deployment_in: DeploymentCreateWithTemplateId
) -> Any:
    """
    Create a new deployment using a template ID
    """
    try:
        # Validate cloud account
        cloud_account = db.query(CloudAccount).filter(
            CloudAccount.account_id == deployment_in.cloud_account_id,
            CloudAccount.tenant_id == current_user.tenant.tenant_id
        ).first()
        
        if not cloud_account:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cloud account with ID {deployment_in.cloud_account_id} not found or does not belong to your tenant"
            )
        
        # Validate environment
        environment = db.query(Environment).filter(
            Environment.environment_id == deployment_in.environment_id,
            Environment.tenant_id == current_user.tenant.tenant_id
        ).first()
        
        if not environment:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Environment with ID {deployment_in.environment_id} not found or does not belong to your tenant"
            )
        
        # Validate template
        template = db.query(Template).filter(
            Template.template_id == deployment_in.template_id,
            Template.tenant_id == current_user.tenant.tenant_id
        ).first()
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Template with ID {deployment_in.template_id} not found or does not belong to your tenant"
            )
        
        # Create deployment details
        deployment = DeploymentDetails(
            name=deployment_in.name,
            description=deployment_in.description,
            status="pending",
            provider=deployment_in.provider,
            cloud_account_id=cloud_account.id,
            template_id=template.id,
            template_type=deployment_in.template_type,
            environment_id=environment.id,
            parameters=deployment_in.parameters,
            variables=deployment_in.variables,
            tenant_id=current_user.tenant.tenant_id,
            created_by=current_user.user_id,
            is_dry_run=deployment_in.is_dry_run,
            auto_approve=deployment_in.auto_approve
        )
        
        db.add(deployment)
        db.commit()
        db.refresh(deployment)
        
        # Format response
        return DeploymentResponse(
            id=deployment.deployment_id,
            name=deployment.name,
            description=deployment.description,
            status=deployment.status,
            provider=deployment.provider,
            cloud_account={
                "id": cloud_account.account_id,
                "name": cloud_account.name,
                "provider": cloud_account.provider
            },
            environment={
                "id": environment.environment_id,
                "name": environment.name
            },
            template_type=deployment.template_type,
            parameters=deployment.parameters,
            variables=deployment.variables,
            outputs=deployment.outputs,
            resources=deployment.resources,
            created_at=deployment.created_at,
            updated_at=deployment.updated_at,
            started_at=deployment.started_at,
            completed_at=deployment.completed_at,
            is_dry_run=deployment.is_dry_run,
            auto_approve=deployment.auto_approve,
            error_message=deployment.error_message
        )
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        error_response = format_error_response(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response["detail"]
        )

@router.post("/deployments/template-url", response_model=DeploymentResponse)
def create_deployment_with_template_url(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    deployment_in: DeploymentCreateWithTemplateUrl
) -> Any:
    """
    Create a new deployment using a template URL
    """
    try:
        # Validate cloud account
        cloud_account = db.query(CloudAccount).filter(
            CloudAccount.account_id == deployment_in.cloud_account_id,
            CloudAccount.tenant_id == current_user.tenant.tenant_id
        ).first()
        
        if not cloud_account:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cloud account with ID {deployment_in.cloud_account_id} not found or does not belong to your tenant"
            )
        
        # Validate environment
        environment = db.query(Environment).filter(
            Environment.environment_id == deployment_in.environment_id,
            Environment.tenant_id == current_user.tenant.tenant_id
        ).first()
        
        if not environment:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Environment with ID {deployment_in.environment_id} not found or does not belong to your tenant"
            )
        
        # Create deployment details
        deployment = DeploymentDetails(
            name=deployment_in.name,
            description=deployment_in.description,
            status="pending",
            provider=deployment_in.provider,
            cloud_account_id=cloud_account.id,
            template_url=deployment_in.template_url,
            template_type=deployment_in.template_type,
            environment_id=environment.id,
            parameters=deployment_in.parameters,
            variables=deployment_in.variables,
            tenant_id=current_user.tenant.tenant_id,
            created_by=current_user.user_id,
            is_dry_run=deployment_in.is_dry_run,
            auto_approve=deployment_in.auto_approve
        )
        
        db.add(deployment)
        db.commit()
        db.refresh(deployment)
        
        # Format response
        return DeploymentResponse(
            id=deployment.deployment_id,
            name=deployment.name,
            description=deployment.description,
            status=deployment.status,
            provider=deployment.provider,
            cloud_account={
                "id": cloud_account.account_id,
                "name": cloud_account.name,
                "provider": cloud_account.provider
            },
            environment={
                "id": environment.environment_id,
                "name": environment.name
            },
            template_type=deployment.template_type,
            parameters=deployment.parameters,
            variables=deployment.variables,
            outputs=deployment.outputs,
            resources=deployment.resources,
            created_at=deployment.created_at,
            updated_at=deployment.updated_at,
            started_at=deployment.started_at,
            completed_at=deployment.completed_at,
            is_dry_run=deployment.is_dry_run,
            auto_approve=deployment.auto_approve,
            error_message=deployment.error_message
        )
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        error_response = format_error_response(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response["detail"]
        )

@router.post("/deployments/template-code", response_model=DeploymentResponse)
def create_deployment_with_template_code(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    deployment_in: DeploymentCreateWithTemplateCode
) -> Any:
    """
    Create a new deployment using template code
    """
    try:
        # Validate cloud account
        cloud_account = db.query(CloudAccount).filter(
            CloudAccount.account_id == deployment_in.cloud_account_id,
            CloudAccount.tenant_id == current_user.tenant.tenant_id
        ).first()
        
        if not cloud_account:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cloud account with ID {deployment_in.cloud_account_id} not found or does not belong to your tenant"
            )
        
        # Validate environment
        environment = db.query(Environment).filter(
            Environment.environment_id == deployment_in.environment_id,
            Environment.tenant_id == current_user.tenant.tenant_id
        ).first()
        
        if not environment:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Environment with ID {deployment_in.environment_id} not found or does not belong to your tenant"
            )
        
        # Create deployment details
        deployment = DeploymentDetails(
            name=deployment_in.name,
            description=deployment_in.description,
            status="pending",
            provider=deployment_in.provider,
            cloud_account_id=cloud_account.id,
            template_code=deployment_in.template_code,
            template_type=deployment_in.template_type,
            environment_id=environment.id,
            parameters=deployment_in.parameters,
            variables=deployment_in.variables,
            tenant_id=current_user.tenant.tenant_id,
            created_by=current_user.user_id,
            is_dry_run=deployment_in.is_dry_run,
            auto_approve=deployment_in.auto_approve
        )
        
        db.add(deployment)
        db.commit()
        db.refresh(deployment)
        
        # Format response
        return DeploymentResponse(
            id=deployment.deployment_id,
            name=deployment.name,
            description=deployment.description,
            status=deployment.status,
            provider=deployment.provider,
            cloud_account={
                "id": cloud_account.account_id,
                "name": cloud_account.name,
                "provider": cloud_account.provider
            },
            environment={
                "id": environment.environment_id,
                "name": environment.name
            },
            template_type=deployment.template_type,
            parameters=deployment.parameters,
            variables=deployment.variables,
            outputs=deployment.outputs,
            resources=deployment.resources,
            created_at=deployment.created_at,
            updated_at=deployment.updated_at,
            started_at=deployment.started_at,
            completed_at=deployment.completed_at,
            is_dry_run=deployment.is_dry_run,
            auto_approve=deployment.auto_approve,
            error_message=deployment.error_message
        )
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        error_response = format_error_response(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response["detail"]
        )

@router.get("/deployments/{deployment_id}", response_model=DeploymentResponse)
def get_deployment(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    deployment_id: str
) -> Any:
    """
    Get deployment details by ID
    """
    try:
        # Get deployment
        deployment = db.query(DeploymentDetails).filter(
            DeploymentDetails.deployment_id == deployment_id,
            DeploymentDetails.tenant_id == current_user.tenant.tenant_id
        ).first()
        
        if not deployment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Deployment with ID {deployment_id} not found or does not belong to your tenant"
            )
        
        # Get cloud account
        cloud_account = db.query(CloudAccount).filter(
            CloudAccount.id == deployment.cloud_account_id
        ).first()
        
        # Get environment
        environment = db.query(Environment).filter(
            Environment.id == deployment.environment_id
        ).first()
        
        # Format response
        return DeploymentResponse(
            id=deployment.deployment_id,
            name=deployment.name,
            description=deployment.description,
            status=deployment.status,
            provider=deployment.provider,
            cloud_account={
                "id": cloud_account.account_id if cloud_account else None,
                "name": cloud_account.name if cloud_account else None,
                "provider": cloud_account.provider if cloud_account else None
            },
            environment={
                "id": environment.environment_id if environment else None,
                "name": environment.name if environment else None
            },
            template_type=deployment.template_type,
            parameters=deployment.parameters,
            variables=deployment.variables,
            outputs=deployment.outputs,
            resources=deployment.resources,
            created_at=deployment.created_at,
            updated_at=deployment.updated_at,
            started_at=deployment.started_at,
            completed_at=deployment.completed_at,
            is_dry_run=deployment.is_dry_run,
            auto_approve=deployment.auto_approve,
            error_message=deployment.error_message
        )
    
    except HTTPException:
        raise
    except Exception as e:
        error_response = format_error_response(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response["detail"]
        )

@router.get("/deployments", response_model=List[DeploymentResponse])
def get_deployments(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    environment_id: Optional[str] = None,
    cloud_account_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
) -> Any:
    """
    Get all deployments for the current user's tenant with optional filtering
    """
    try:
        # Base query
        query = db.query(DeploymentDetails).filter(
            DeploymentDetails.tenant_id == current_user.tenant.tenant_id
        )
        
        # Apply filters
        if environment_id:
            environment = db.query(Environment).filter(
                Environment.environment_id == environment_id
            ).first()
            if environment:
                query = query.filter(DeploymentDetails.environment_id == environment.id)
        
        if cloud_account_id:
            cloud_account = db.query(CloudAccount).filter(
                CloudAccount.account_id == cloud_account_id
            ).first()
            if cloud_account:
                query = query.filter(DeploymentDetails.cloud_account_id == cloud_account.id)
        
        if status:
            query = query.filter(DeploymentDetails.status == status)
        
        # Apply pagination
        query = query.order_by(DeploymentDetails.created_at.desc()).offset(offset).limit(limit)
        
        # Get deployments
        deployments = query.all()
        
        # Format response
        result = []
        for deployment in deployments:
            # Get cloud account
            cloud_account = db.query(CloudAccount).filter(
                CloudAccount.id == deployment.cloud_account_id
            ).first()
            
            # Get environment
            environment = db.query(Environment).filter(
                Environment.id == deployment.environment_id
            ).first()
            
            result.append(DeploymentResponse(
                id=deployment.deployment_id,
                name=deployment.name,
                description=deployment.description,
                status=deployment.status,
                provider=deployment.provider,
                cloud_account={
                    "id": cloud_account.account_id if cloud_account else None,
                    "name": cloud_account.name if cloud_account else None,
                    "provider": cloud_account.provider if cloud_account else None
                },
                environment={
                    "id": environment.environment_id if environment else None,
                    "name": environment.name if environment else None
                },
                template_type=deployment.template_type,
                parameters=deployment.parameters,
                variables=deployment.variables,
                outputs=deployment.outputs,
                resources=deployment.resources,
                created_at=deployment.created_at,
                updated_at=deployment.updated_at,
                started_at=deployment.started_at,
                completed_at=deployment.completed_at,
                is_dry_run=deployment.is_dry_run,
                auto_approve=deployment.auto_approve,
                error_message=deployment.error_message
            ))
        
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        error_response = format_error_response(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response["detail"]
        )

@router.put("/deployments/{deployment_id}", response_model=DeploymentResponse)
def update_deployment(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    deployment_id: str,
    deployment_update: DeploymentUpdate
) -> Any:
    """
    Update deployment status and details
    """
    try:
        # Get deployment
        deployment = db.query(DeploymentDetails).filter(
            DeploymentDetails.deployment_id == deployment_id,
            DeploymentDetails.tenant_id == current_user.tenant.tenant_id
        ).first()
        
        if not deployment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Deployment with ID {deployment_id} not found or does not belong to your tenant"
            )
        
        # Update deployment
        if deployment_update.status is not None:
            deployment.status = deployment_update.status
            
            # Set started_at if status is running
            if deployment_update.status == "running" and not deployment.started_at:
                deployment.started_at = datetime.utcnow()
            
            # Set completed_at if status is completed or failed
            if deployment_update.status in ["completed", "failed"] and not deployment.completed_at:
                deployment.completed_at = datetime.utcnow()
        
        if deployment_update.outputs is not None:
            deployment.outputs = deployment_update.outputs
        
        if deployment_update.resources is not None:
            deployment.resources = deployment_update.resources
        
        if deployment_update.logs is not None:
            deployment.logs = deployment_update.logs
        
        if deployment_update.error_message is not None:
            deployment.error_message = deployment_update.error_message
        
        if deployment_update.error_details is not None:
            deployment.error_details = deployment_update.error_details
        
        if deployment_update.completed_at is not None:
            deployment.completed_at = deployment_update.completed_at
        
        # Update updated_by and updated_at
        deployment.updated_by = current_user.user_id
        deployment.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(deployment)
        
        # Get cloud account
        cloud_account = db.query(CloudAccount).filter(
            CloudAccount.id == deployment.cloud_account_id
        ).first()
        
        # Get environment
        environment = db.query(Environment).filter(
            Environment.id == deployment.environment_id
        ).first()
        
        # Format response
        return DeploymentResponse(
            id=deployment.deployment_id,
            name=deployment.name,
            description=deployment.description,
            status=deployment.status,
            provider=deployment.provider,
            cloud_account={
                "id": cloud_account.account_id if cloud_account else None,
                "name": cloud_account.name if cloud_account else None,
                "provider": cloud_account.provider if cloud_account else None
            },
            environment={
                "id": environment.environment_id if environment else None,
                "name": environment.name if environment else None
            },
            template_type=deployment.template_type,
            parameters=deployment.parameters,
            variables=deployment.variables,
            outputs=deployment.outputs,
            resources=deployment.resources,
            created_at=deployment.created_at,
            updated_at=deployment.updated_at,
            started_at=deployment.started_at,
            completed_at=deployment.completed_at,
            is_dry_run=deployment.is_dry_run,
            auto_approve=deployment.auto_approve,
            error_message=deployment.error_message
        )
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        error_response = format_error_response(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response["detail"]
        )

@router.delete("/deployments/{deployment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_deployment(
    *,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    deployment_id: str
) -> Any:
    """
    Delete a deployment
    """
    try:
        # Get deployment
        deployment = db.query(DeploymentDetails).filter(
            DeploymentDetails.deployment_id == deployment_id,
            DeploymentDetails.tenant_id == current_user.tenant.tenant_id
        ).first()
        
        if not deployment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Deployment with ID {deployment_id} not found or does not belong to your tenant"
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
        error_response = format_error_response(e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=error_response["detail"]
        )


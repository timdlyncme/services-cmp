from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.api.endpoints.auth import get_current_user
from app.db.session import get_db
from app.models.user import User, Tenant
from app.models.deployment import Deployment, Template, Environment, CloudAccount
from app.schemas.deployment import (
    DeploymentResponse, DeploymentCreate, DeploymentUpdate,
    CloudDeploymentResponse
)

router = APIRouter()


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
            Deployment, Template, Environment, CloudAccount
        ).join(
            Template, Deployment.template_id == Template.id
        ).join(
            Environment, Deployment.environment_id == Environment.id
        ).join(
            CloudAccount, Deployment.cloud_account_id == CloudAccount.id
        )
        
        # Filter by tenant
        if tenant_id:
            tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
            if not tenant:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Tenant with ID {tenant_id} not found"
                )
            query = query.filter(Deployment.tenant_id == tenant.id)
        else:
            # Default to current user's tenant
            query = query.filter(Deployment.tenant_id == current_user.tenant_id)
        
        results = query.all()
        
        # Convert to frontend-compatible format
        deployments = []
        for deployment, template, environment, cloud_account in results:
            deployments.append(CloudDeploymentResponse(
                id=deployment.deployment_id,
                name=deployment.name,
                templateId=template.template_id,
                templateName=template.name,
                provider=cloud_account.provider,
                status=deployment.status,
                environment=environment.name,
                createdAt=deployment.created_at.isoformat(),
                updatedAt=deployment.updated_at.isoformat(),
                parameters={},  # Would need to add a parameters table or JSON field
                resources=[],   # Would need to add a resources table or JSON field
                tenantId=current_user.tenant.tenant_id
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
            Deployment, Template, Environment, CloudAccount
        ).join(
            Template, Deployment.template_id == Template.id
        ).join(
            Environment, Deployment.environment_id == Environment.id
        ).join(
            CloudAccount, Deployment.cloud_account_id == CloudAccount.id
        ).filter(
            Deployment.deployment_id == deployment_id
        ).first()
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Deployment with ID {deployment_id} not found"
            )
        
        deployment, template, environment, cloud_account = result
        
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
            provider=cloud_account.provider,
            status=deployment.status,
            environment=environment.name,
            createdAt=deployment.created_at.isoformat(),
            updatedAt=deployment.updated_at.isoformat(),
            parameters={},  # Would need to add a parameters table or JSON field
            resources=[],   # Would need to add a resources table or JSON field
            tenantId=current_user.tenant.tenant_id
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
        
        # Verify cloud account exists
        cloud_account = db.query(CloudAccount).filter(CloudAccount.id == deployment.cloud_account_id).first()
        if not cloud_account:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Cloud account with ID {deployment.cloud_account_id} not found"
            )
        
        # Create new deployment
        import uuid
        new_deployment = Deployment(
            deployment_id=str(uuid.uuid4()),
            name=deployment.name,
            status=deployment.status,
            template_id=deployment.template_id,
            environment_id=deployment.environment_id,
            cloud_account_id=deployment.cloud_account_id,
            tenant_id=current_user.tenant_id,
            created_by_id=current_user.id
        )
        
        db.add(new_deployment)
        db.commit()
        db.refresh(new_deployment)
        
        # Return frontend-compatible response
        return CloudDeploymentResponse(
            id=new_deployment.deployment_id,
            name=new_deployment.name,
            templateId=template.template_id,
            templateName=template.name,
            provider=cloud_account.provider,
            status=new_deployment.status,
            environment=environment.name,
            createdAt=new_deployment.created_at.isoformat(),
            updatedAt=new_deployment.updated_at.isoformat(),
            parameters={},
            resources=[],
            tenantId=current_user.tenant.tenant_id
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
            Deployment, Template, Environment, CloudAccount
        ).join(
            Template, Deployment.template_id == Template.id
        ).join(
            Environment, Deployment.environment_id == Environment.id
        ).join(
            CloudAccount, Deployment.cloud_account_id == CloudAccount.id
        ).filter(
            Deployment.deployment_id == deployment_id
        ).first()
        
        if not result:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Deployment with ID {deployment_id} not found"
            )
        
        deployment, template, environment, cloud_account = result
        
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
        
        db.commit()
        db.refresh(deployment)
        
        # Return frontend-compatible response
        return CloudDeploymentResponse(
            id=deployment.deployment_id,
            name=deployment.name,
            templateId=template.template_id,
            templateName=template.name,
            provider=cloud_account.provider,
            status=deployment.status,
            environment=environment.name,
            createdAt=deployment.created_at.isoformat(),
            updatedAt=deployment.updated_at.isoformat(),
            parameters={},
            resources=[],
            tenantId=current_user.tenant.tenant_id
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


@router.delete("/{deployment_id}", status_code=status.HTTP_204_NO_CONTENT)
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


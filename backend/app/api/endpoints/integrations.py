from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Query
from sqlalchemy.orm import Session

from app.api.endpoints.auth import get_current_user
from app.db.session import get_db
from app.models.user import User, Tenant
from app.models.integration import IntegrationConfig
from app.schemas.integration import (
    IntegrationConfigResponse, IntegrationConfigCreate, IntegrationConfigUpdate,
    IntegrationConfigFrontendResponse
)

router = APIRouter()


@router.get("/", response_model=List[IntegrationConfigFrontendResponse])
def get_integrations(
    tenant_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get all integration configs for the current user's tenant or a specific tenant
    """
    # Add CORS headers
    response = Response()
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    
    # Check if user has permission to view settings
    has_permission = any(p.name == "view:settings" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        query = db.query(IntegrationConfig)
        
        # Filter by tenant
        if tenant_id:
            tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
            if not tenant:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Tenant with ID {tenant_id} not found"
                )
            query = query.filter(IntegrationConfig.tenant_id == tenant.id)
        else:
            # Default to current user's tenant
            query = query.filter(IntegrationConfig.tenant_id == current_user.tenant_id)
        
        integrations = query.all()
        
        # Convert to frontend-compatible format
        return [
            IntegrationConfigFrontendResponse(
                id=integration.integration_id,
                name=integration.name,
                type=integration.type,
                provider=integration.provider,
                status=integration.status,
                lastChecked=integration.last_checked.isoformat(),
                tenantId=current_user.tenant.tenant_id,
                settings=integration.settings
            )
            for integration in integrations
        ]
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving integrations: {str(e)}"
        )


@router.get("/{integration_id}", response_model=IntegrationConfigFrontendResponse)
def get_integration(
    integration_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get a specific integration config by ID
    """
    # Check if user has permission to view settings
    has_permission = any(p.name == "view:settings" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        integration = db.query(IntegrationConfig).filter(IntegrationConfig.integration_id == integration_id).first()
        
        if not integration:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Integration with ID {integration_id} not found"
            )
        
        # Check if user has access to this integration's tenant
        if integration.tenant_id != current_user.tenant_id:
            # Admin users can view all integrations
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to access this integration"
                )
        
        # Convert to frontend-compatible format
        return IntegrationConfigFrontendResponse(
            id=integration.integration_id,
            name=integration.name,
            type=integration.type,
            provider=integration.provider,
            status=integration.status,
            lastChecked=integration.last_checked.isoformat(),
            tenantId=current_user.tenant.tenant_id,
            settings=integration.settings
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving integration: {str(e)}"
        )


@router.post("/", response_model=IntegrationConfigFrontendResponse)
def create_integration(
    integration: IntegrationConfigCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Create a new integration config
    """
    # Check if user has permission to update settings
    has_permission = any(p.name == "update:settings" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Create new integration
        import uuid
        from datetime import datetime
        
        new_integration = IntegrationConfig(
            integration_id=str(uuid.uuid4()),
            name=integration.name,
            type=integration.type,
            provider=integration.provider,
            status=integration.status,
            last_checked=datetime.utcnow(),
            settings=integration.settings,
            tenant_id=current_user.tenant_id
        )
        
        db.add(new_integration)
        db.commit()
        db.refresh(new_integration)
        
        # Return frontend-compatible response
        return IntegrationConfigFrontendResponse(
            id=new_integration.integration_id,
            name=new_integration.name,
            type=new_integration.type,
            provider=new_integration.provider,
            status=new_integration.status,
            lastChecked=new_integration.last_checked.isoformat(),
            tenantId=current_user.tenant.tenant_id,
            settings=new_integration.settings
        )
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating integration: {str(e)}"
        )


@router.put("/{integration_id}", response_model=IntegrationConfigFrontendResponse)
def update_integration(
    integration_id: str,
    integration_update: IntegrationConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Update an integration config
    """
    # Check if user has permission to update settings
    has_permission = any(p.name == "update:settings" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Get the integration
        integration = db.query(IntegrationConfig).filter(IntegrationConfig.integration_id == integration_id).first()
        
        if not integration:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Integration with ID {integration_id} not found"
            )
        
        # Check if user has access to this integration's tenant
        if integration.tenant_id != current_user.tenant_id:
            # Admin users can update all integrations
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to update this integration"
                )
        
        # Update integration
        integration.name = integration_update.name
        integration.type = integration_update.type
        integration.provider = integration_update.provider
        integration.status = integration_update.status
        integration.settings = integration_update.settings
        
        from datetime import datetime
        integration.last_checked = datetime.utcnow()
        
        db.commit()
        db.refresh(integration)
        
        # Return frontend-compatible response
        return IntegrationConfigFrontendResponse(
            id=integration.integration_id,
            name=integration.name,
            type=integration.type,
            provider=integration.provider,
            status=integration.status,
            lastChecked=integration.last_checked.isoformat(),
            tenantId=current_user.tenant.tenant_id,
            settings=integration.settings
        )
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating integration: {str(e)}"
        )


@router.delete("/{integration_id}")
def delete_integration(
    integration_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Delete an integration config
    """
    # Check if user has permission to update settings
    has_permission = any(p.name == "update:settings" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Get the integration
        integration = db.query(IntegrationConfig).filter(IntegrationConfig.integration_id == integration_id).first()
        
        if not integration:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Integration with ID {integration_id} not found"
            )
        
        # Check if user has access to this integration's tenant
        if integration.tenant_id != current_user.tenant_id:
            # Admin users can delete all integrations
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to delete this integration"
                )
        
        # Delete integration
        db.delete(integration)
        db.commit()
        
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting integration: {str(e)}"
        )


@router.options("/")
def options_integrations():
    """
    Handle preflight requests for integrations
    """
    response = Response(status_code=200)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response


@router.options("/{integration_id}")
def options_integration_by_id():
    """
    Handle preflight requests for specific integration
    """
    response = Response(status_code=200)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

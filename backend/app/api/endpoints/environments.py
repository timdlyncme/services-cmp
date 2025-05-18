from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Query
from sqlalchemy.orm import Session

from app.api.endpoints.auth import get_current_user
from app.db.session import get_db
from app.models.user import User, Tenant
from app.models.deployment import Environment, CloudAccount
from app.schemas.deployment import EnvironmentResponse, EnvironmentCreate, EnvironmentUpdate

router = APIRouter()


@router.get("/", response_model=List[EnvironmentResponse])
def get_environments(
    tenant_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get all environments for the current user's tenant or a specific tenant
    """
    # Add CORS headers
    response = Response()
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    
    # Check if user has permission to view environments
    has_permission = any(p.name == "view:environments" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        query = db.query(Environment)
        
        # Filter by tenant
        if tenant_id:
            tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
            if not tenant:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Tenant with ID {tenant_id} not found"
                )
            query = query.filter(Environment.tenant_id == tenant.id)
        else:
            # Default to current user's tenant
            query = query.filter(Environment.tenant_id == current_user.tenant_id)
        
        environments = query.all()
        
        return [
            EnvironmentResponse(
                id=env.id,
                environment_id=env.environment_id,
                name=env.name,
                description=env.description,
                tenant_id=env.tenant_id
            )
            for env in environments
        ]
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving environments: {str(e)}"
        )


@router.get("/{environment_id}", response_model=EnvironmentResponse)
def get_environment(
    environment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get a specific environment by ID
    """
    # Check if user has permission to view environments
    has_permission = any(p.name == "view:environments" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        environment = db.query(Environment).filter(Environment.environment_id == environment_id).first()
        
        if not environment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Environment with ID {environment_id} not found"
            )
        
        # Check if user has access to this environment's tenant
        if environment.tenant_id != current_user.tenant_id:
            # Admin users can view all environments
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to access this environment"
                )
        
        return EnvironmentResponse(
            id=environment.id,
            environment_id=environment.environment_id,
            name=environment.name,
            description=environment.description,
            tenant_id=environment.tenant_id
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving environment: {str(e)}"
        )


@router.post("/", response_model=EnvironmentResponse)
def create_environment(
    environment: EnvironmentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Create a new environment
    """
    # Check if user has permission to create environments
    has_permission = any(p.name == "create:environments" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Create new environment
        import uuid
        new_environment = Environment(
            environment_id=str(uuid.uuid4()),
            name=environment.name,
            description=environment.description,
            tenant_id=current_user.tenant_id
        )
        
        db.add(new_environment)
        db.commit()
        db.refresh(new_environment)
        
        return EnvironmentResponse(
            id=new_environment.id,
            environment_id=new_environment.environment_id,
            name=new_environment.name,
            description=new_environment.description,
            tenant_id=new_environment.tenant_id
        )
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating environment: {str(e)}"
        )


@router.put("/{environment_id}", response_model=EnvironmentResponse)
def update_environment(
    environment_id: str,
    environment_update: EnvironmentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Update an environment
    """
    # Check if user has permission to update environments
    has_permission = any(p.name == "update:environments" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Get the environment
        environment = db.query(Environment).filter(Environment.environment_id == environment_id).first()
        
        if not environment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Environment with ID {environment_id} not found"
            )
        
        # Check if user has access to this environment's tenant
        if environment.tenant_id != current_user.tenant_id:
            # Admin users can update all environments
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to update this environment"
                )
        
        # Update environment
        environment.name = environment_update.name
        environment.description = environment_update.description
        
        db.commit()
        db.refresh(environment)
        
        return EnvironmentResponse(
            id=environment.id,
            environment_id=environment.environment_id,
            name=environment.name,
            description=environment.description,
            tenant_id=environment.tenant_id
        )
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating environment: {str(e)}"
        )


@router.delete("/{environment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_environment(
    environment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Delete an environment
    """
    # Check if user has permission to delete environments
    has_permission = any(p.name == "delete:environments" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Get the environment
        environment = db.query(Environment).filter(Environment.environment_id == environment_id).first()
        
        if not environment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Environment with ID {environment_id} not found"
            )
        
        # Check if user has access to this environment's tenant
        if environment.tenant_id != current_user.tenant_id:
            # Admin users can delete all environments
            if current_user.role.name != "admin" and current_user.role.name != "msp":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to delete this environment"
                )
        
        # Check if environment is used by any deployments
        from app.models.deployment import Deployment
        deployments = db.query(Deployment).filter(Deployment.environment_id == environment.id).first()
        if deployments:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete environment that is used by deployments"
            )
        
        # Delete environment
        db.delete(environment)
        db.commit()
        
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting environment: {str(e)}"
        )


@router.options("/")
def options_environments():
    """
    Handle preflight requests for environments
    """
    response = Response(status_code=200)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response


@router.options("/{environment_id}")
def options_environment_by_id():
    """
    Handle preflight requests for specific environment
    """
    response = Response(status_code=200)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response


from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Query
from sqlalchemy.orm import Session

from app.api.endpoints.auth import get_current_user
from app.db.session import get_db
from app.models.user import User, Tenant
from app.models.deployment import Environment, CloudAccount
from app.schemas.deployment import EnvironmentResponse, EnvironmentCreate, EnvironmentUpdate, CloudAccountResponse

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
        # If no tenant_id is provided, check if user has a tenant
        if not tenant_id:
            # For admin and MSP users, require explicit tenant_id
            if current_user.role.name in ["admin", "msp"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Please specify a valid tenant_id when fetching environment details"
                )
            
            # For regular users, use their tenant
            user_tenant = db.query(Tenant).filter(Tenant.tenant_id == current_user.tenant_id).first()
            if not user_tenant:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Please specify a valid tenant_id when fetching environment details"
                )
            
            tenant_id = user_tenant.tenant_id
        
        query = db.query(Environment)
        
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
                detail="Not authorized to view environments for this tenant"
            )
        
        # Filter by tenant
        query = query.filter(Environment.tenant_id == tenant.tenant_id)
        
        environments = query.all()
        
        result = []
        for env in environments:
            # Get associated cloud accounts for response
            cloud_accounts = []
            for account in env.cloud_accounts:
                cloud_accounts.append(
                    CloudAccountResponse(
                        id=account.id,
                        account_id=account.account_id,
                        name=account.name,
                        provider=account.provider,
                        status=account.status,
                        description=account.description,
                        tenant_id=account.tenant_id
                    )
                )
            
            result.append(
                EnvironmentResponse(
                    id=env.id,
                    environment_id=env.environment_id,
                    name=env.name,
                    description=env.description,
                    tenant_id=env.tenant_id,
                    cloud_accounts=cloud_accounts
                )
            )
        
        return result
    
    except HTTPException:
        raise
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
        
        # Get associated cloud accounts for response
        cloud_accounts = []
        for account in environment.cloud_accounts:
            cloud_accounts.append(
                CloudAccountResponse(
                    id=account.id,
                    account_id=account.account_id,
                    name=account.name,
                    provider=account.provider,
                    status=account.status,
                    description=account.description,
                    tenant_id=account.tenant_id
                )
            )
        
        return EnvironmentResponse(
            id=environment.id,
            environment_id=environment.environment_id,
            name=environment.name,
            description=environment.description,
            tenant_id=environment.tenant_id,
            cloud_accounts=cloud_accounts
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
    tenant_id: Optional[str] = None,
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
        # Determine which tenant to use
        user_tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
        if not user_tenant:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User's tenant not found"
            )
        
        target_tenant_id = user_tenant.tenant_id
        
        # If tenant_id is provided, use that instead
        if tenant_id:
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
                    detail="Not authorized to create environments for this tenant"
                )
            
            target_tenant_id = tenant.tenant_id
        
        # Create new environment
        import uuid
        new_environment = Environment(
            environment_id=str(uuid.uuid4()),
            name=environment.name,
            description=environment.description,
            tenant_id=target_tenant_id,
            update_strategy=environment.update_strategy,
            scaling_policies=environment.scaling_policies,
            environment_variables=environment.environment_variables,
            logging_config=environment.logging_config,
            monitoring_integration=environment.monitoring_integration
        )
        
        db.add(new_environment)
        db.commit()
        db.refresh(new_environment)
        
        # Add cloud account associations if provided
        if environment.cloud_account_ids:
            for account_id in environment.cloud_account_ids:
                cloud_account = db.query(CloudAccount).filter(CloudAccount.id == account_id).first()
                if cloud_account:
                    new_environment.cloud_accounts.append(cloud_account)
            
            db.commit()
            db.refresh(new_environment)
        
        # Get associated cloud accounts for response
        cloud_accounts = []
        for account in new_environment.cloud_accounts:
            cloud_accounts.append(
                CloudAccountResponse(
                    id=account.id,
                    account_id=account.account_id,
                    name=account.name,
                    provider=account.provider,
                    status=account.status,
                    description=account.description,
                    tenant_id=account.tenant_id
                )
            )
        
        return EnvironmentResponse(
            id=new_environment.id,
            environment_id=new_environment.environment_id,
            name=new_environment.name,
            description=new_environment.description,
            tenant_id=new_environment.tenant_id,
            cloud_accounts=cloud_accounts
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
        
        # Update new fields if provided
        if environment_update.update_strategy is not None:
            environment.update_strategy = environment_update.update_strategy
        
        if environment_update.scaling_policies is not None:
            environment.scaling_policies = environment_update.scaling_policies
        
        if environment_update.environment_variables is not None:
            environment.environment_variables = environment_update.environment_variables
        
        if environment_update.logging_config is not None:
            environment.logging_config = environment_update.logging_config
        
        if environment_update.monitoring_integration is not None:
            environment.monitoring_integration = environment_update.monitoring_integration
        
        # Update cloud account associations if provided
        if environment_update.cloud_account_ids is not None:
            # Clear existing associations
            environment.cloud_accounts = []
            
            # Add new associations
            for account_id in environment_update.cloud_account_ids:
                cloud_account = db.query(CloudAccount).filter(CloudAccount.id == account_id).first()
                if cloud_account:
                    environment.cloud_accounts.append(cloud_account)
        
        db.commit()
        db.refresh(environment)
        
        # Get associated cloud accounts for response
        cloud_accounts = []
        for account in environment.cloud_accounts:
            cloud_accounts.append(
                CloudAccountResponse(
                    id=account.id,
                    account_id=account.account_id,
                    name=account.name,
                    provider=account.provider,
                    status=account.status,
                    description=account.description,
                    tenant_id=account.tenant_id
                )
            )
        
        return EnvironmentResponse(
            id=environment.id,
            environment_id=environment.environment_id,
            name=environment.name,
            description=environment.description,
            tenant_id=environment.tenant_id,
            cloud_accounts=cloud_accounts
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


@router.delete("/{environment_id}")
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

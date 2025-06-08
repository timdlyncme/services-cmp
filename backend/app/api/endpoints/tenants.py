from typing import Any, List
import uuid
import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session

from app.api.endpoints.auth import get_current_user
from app.db.session import get_db
from app.models.user import Tenant, User
from app.schemas.tenant import TenantResponse, TenantCreate, TenantUpdate
from app.core.permissions import has_global_permission, get_user_accessible_tenants
from app.models.user_tenant_assignment import UserTenantAssignment

router = APIRouter()


@router.get("/", response_model=List[TenantResponse])
def get_tenants(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get all tenants accessible to the current user
    """
    try:
        if current_user.is_msp_user:
            # MSP users can see all tenants
            tenants = db.query(Tenant).filter(Tenant.is_active == True).all()
        else:
            # Regular users can only see their assigned tenants
            user_tenant_assignments = db.query(UserTenantAssignment).filter(
                UserTenantAssignment.user_id == current_user.id,
                UserTenantAssignment.is_active == True
            ).all()
            
            tenant_ids = [assignment.tenant_id for assignment in user_tenant_assignments]
            tenants = db.query(Tenant).filter(
                Tenant.tenant_id.in_(tenant_ids),
                Tenant.is_active == True
            ).all()
        
        return [
            TenantResponse(
                id=tenant.tenant_id,
                tenant_id=tenant.tenant_id,
                name=tenant.name,
                description=tenant.description,
                date_created=tenant.date_created.isoformat() if tenant.date_created else None,
                date_modified=tenant.date_modified.isoformat() if tenant.date_modified else None
            )
            for tenant in tenants
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving tenants: {str(e)}"
        )


@router.get("/available", response_model=List[TenantResponse])
def get_available_tenants(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get all tenants available for user assignment based on current user's permissions
    MSP users can assign to any tenant, regular users can only assign to their accessible tenants
    """
    try:
        if current_user.is_msp_user:
            # MSP users can assign to any tenant
            tenants = db.query(Tenant).filter(Tenant.is_active == True).all()
        else:
            # Regular users can only assign to tenants they have access to
            user_tenant_assignments = db.query(UserTenantAssignment).filter(
                UserTenantAssignment.user_id == current_user.id,
                UserTenantAssignment.is_active == True
            ).all()
            
            tenant_ids = [assignment.tenant_id for assignment in user_tenant_assignments]
            tenants = db.query(Tenant).filter(
                Tenant.tenant_id.in_(tenant_ids),
                Tenant.is_active == True
            ).all()
        
        return [
            TenantResponse(
                id=tenant.tenant_id,
                tenant_id=tenant.tenant_id,
                name=tenant.name,
                description=tenant.description,
                date_created=tenant.date_created.isoformat() if tenant.date_created else None,
                date_modified=tenant.date_modified.isoformat() if tenant.date_modified else None
            )
            for tenant in tenants
        ]
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving available tenants: {str(e)}"
        )


@router.get("/{tenant_id}", response_model=TenantResponse)
def get_tenant(
    tenant_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get a specific tenant by ID
    """
    # Check if user has permission to view tenants
    has_permission = any(p.name == "list:tenants" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Handle different tenant ID formats
        try:
            # Remove 'tenant-' prefix if present
            if tenant_id.startswith('tenant-'):
                tenant_id = tenant_id[7:]
            
            # Check if tenant_id contains query parameters
            if '=' in tenant_id:
                # Extract the actual UUID from the query parameter
                parts = tenant_id.split('=')
                if len(parts) > 1:
                    tenant_id = parts[1]
            
            # Try to parse as UUID
            try:
                uuid_obj = uuid.UUID(tenant_id)
                tenant = db.query(Tenant).filter(Tenant.tenant_id == str(uuid_obj)).first()
            except ValueError:
                # Not a valid UUID, try to find by numeric ID
                try:
                    id_value = int(tenant_id)
                    tenant = db.query(Tenant).filter(Tenant.id == id_value).first()
                except (ValueError, TypeError):
                    tenant = None
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid tenant ID format: {str(e)}"
            )
        
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tenant with ID {tenant_id} not found"
            )
        
        return TenantResponse(
            id=tenant.id,
            tenant_id=tenant.tenant_id,
            name=tenant.name,
            description=tenant.description,
            date_created=tenant.date_created,
            date_modified=tenant.date_modified
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving tenant: {str(e)}"
        )


@router.post("/", response_model=TenantResponse)
def create_tenant(
    tenant: TenantCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Create a new tenant
    """
    # Check if user has permission to create tenants
    has_permission = any(p.name == "create:tenants" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Create new tenant
        import uuid
        new_tenant = Tenant(
            tenant_id=str(uuid.uuid4()),
            name=tenant.name,
            description=tenant.description,
            date_created=datetime.datetime.utcnow(),
            date_modified=datetime.datetime.utcnow()
        )
        
        db.add(new_tenant)
        db.commit()
        db.refresh(new_tenant)
        
        return TenantResponse(
            id=new_tenant.id,
            tenant_id=new_tenant.tenant_id,
            name=new_tenant.name,
            description=new_tenant.description,
            date_created=new_tenant.date_created,
            date_modified=new_tenant.date_modified
        )
    
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating tenant: {str(e)}"
        )


@router.put("/{tenant_id}", response_model=TenantResponse)
def update_tenant(
    tenant_id: str,
    tenant_update: TenantUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Update a tenant
    """
    # Check if user has permission to update tenants
    has_permission = any(p.name == "update:tenants" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Get the tenant
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tenant with ID {tenant_id} not found"
            )
        
        # Update tenant
        tenant.name = tenant_update.name
        tenant.description = tenant_update.description
        tenant.date_modified = datetime.datetime.utcnow()
        
        db.commit()
        db.refresh(tenant)
        
        return TenantResponse(
            id=tenant.id,
            tenant_id=tenant.tenant_id,
            name=tenant.name,
            description=tenant.description,
            date_created=tenant.date_created,
            date_modified=tenant.date_modified
        )
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error updating tenant: {str(e)}"
        )


@router.delete("/{tenant_id}")
def delete_tenant(
    tenant_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Delete a tenant
    """
    # Check if user has permission to delete tenants
    has_permission = any(p.name == "delete:tenants" for p in current_user.role.permissions)
    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Get the tenant
        tenant = db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()
        
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tenant with ID {tenant_id} not found"
            )
        
        # Check if tenant has any users
        users = db.query(User).filter(User.tenant_id == tenant.tenant_id).first()
        if users:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete tenant that has users"
            )
        
        # Check if tenant has any cloud accounts
        from app.models.deployment import CloudAccount
        cloud_accounts = db.query(CloudAccount).filter(CloudAccount.tenant_id == tenant.tenant_id).first()
        if cloud_accounts:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete tenant that has cloud accounts"
            )
        
        # Check if tenant has any environments
        from app.models.deployment import Environment
        environments = db.query(Environment).filter(Environment.tenant_id == tenant.tenant_id).first()
        if environments:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete tenant that has environments"
            )
        
        # Check if tenant has any templates
        from app.models.deployment import Template
        templates = db.query(Template).filter(Template.tenant_id == tenant.tenant_id).first()
        if templates:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete tenant that has templates"
            )
        
        # Check if tenant has any deployments
        from app.models.deployment import Deployment
        deployments = db.query(Deployment).filter(Deployment.tenant_id == tenant.tenant_id).first()
        if deployments:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete tenant that has deployments"
            )
        
        # Delete tenant
        db.delete(tenant)
        db.commit()
        
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting tenant: {str(e)}"
        )


@router.options("/")
def options_tenants():
    """
    Handle preflight requests for tenants
    """
    response = Response(status_code=200)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response


@router.options("/{tenant_id}")
def options_tenant_by_id():
    """
    Handle preflight requests for specific tenant
    """
    response = Response(status_code=200)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

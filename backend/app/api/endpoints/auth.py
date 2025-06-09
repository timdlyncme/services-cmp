from datetime import timedelta
from typing import Any
import uuid

from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.core.security import authenticate_user, create_access_token
from app.core.permissions import get_user_accessible_tenants, get_user_permissions_in_tenant, can_user_switch_to_tenant
from app.core.tenant_utils import get_user_role_in_tenant, get_user_permissions_in_tenant as get_tenant_permissions
from app.models.user import User
from app.schemas.user import Token, LoginResponse, User, TenantAssignmentResponse
from app.db.session import get_db

router = APIRouter()


class SwitchTenantRequest(BaseModel):
    tenant_id: str


@router.post("/login", response_model=LoginResponse)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token_expires = timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Get user's accessible tenants
    accessible_tenants = get_user_accessible_tenants(user, db)
    
    # Determine current tenant (primary tenant or first available)
    current_tenant_id = None
    if user.is_msp_user:
        # MSP users default to the first tenant or their primary tenant
        primary_assignment = user.get_primary_tenant_assignment()
        current_tenant_id = primary_assignment.tenant_id if primary_assignment else (accessible_tenants[0] if accessible_tenants else None)
    else:
        # Regular users default to their primary tenant
        primary_assignment = user.get_primary_tenant_assignment()
        current_tenant_id = primary_assignment.tenant_id if primary_assignment else None
    
    # Get current role and permissions based on tenant context
    current_role = get_user_role_in_tenant(user, current_tenant_id)
    
    if current_tenant_id:
        permissions = get_tenant_permissions(user, current_tenant_id)
    else:
        # Fallback to legacy permission system if no tenant context
        permissions = get_user_permissions_in_tenant(user, current_tenant_id)

    # Create access token with tenant context
    access_token = create_access_token(
        subject=user.user_id, expires_delta=access_token_expires
    )
    
    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=User(
            id=user.user_id,
            name=user.full_name,
            email=user.email,
            role=current_role,
            tenantId=current_tenant_id,
            permissions=permissions,
            accessibleTenants=accessible_tenants,
            isMspUser=user.is_msp_user,
            tenant_assignments=[
                TenantAssignmentResponse(
                    tenant_id=assignment.tenant_id,
                    tenant_name=assignment.tenant.name if assignment.tenant else None,
                    role_id=assignment.role_id,
                    role_name=assignment.role.name if assignment.role else None,
                    is_primary=assignment.is_primary,
                    is_active=assignment.is_active,
                    provisioned_via=assignment.provisioned_via,
                    external_group_id=assignment.external_group_id,
                    external_role_mapping=assignment.external_role_mapping
                ) for assignment in user.get_tenant_assignments()
            ]
        )
    )


@router.options("/login")
def options_login():
    """
    Handle preflight requests for login
    """
    response = Response(status_code=200)
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response


@router.get("/me", response_model=User)
def read_users_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get current user information with tenant context
    """
    # Add CORS headers
    response = Response()
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    
    # Get user's accessible tenants
    accessible_tenants = get_user_accessible_tenants(current_user, db)
    
    # Determine current tenant (primary tenant or first available)
    current_tenant_id = None
    if current_user.is_msp_user:
        # MSP users default to the first tenant or their primary tenant
        primary_assignment = current_user.get_primary_tenant_assignment()
        current_tenant_id = primary_assignment.tenant_id if primary_assignment else (accessible_tenants[0] if accessible_tenants else None)
    else:
        # Regular users default to their primary tenant
        primary_assignment = current_user.get_primary_tenant_assignment()
        current_tenant_id = primary_assignment.tenant_id if primary_assignment else None
    
    # Get current role and permissions based on tenant context
    current_role = get_user_role_in_tenant(current_user, current_tenant_id)
    
    if current_tenant_id:
        permissions = get_tenant_permissions(current_user, current_tenant_id)
    else:
        # Fallback to legacy permission system if no tenant context
        permissions = get_user_permissions_in_tenant(current_user, current_tenant_id)

    return User(
        id=current_user.user_id,
        name=current_user.full_name,
        email=current_user.email,
        role=current_role,
        tenantId=current_tenant_id,
        permissions=permissions,
        accessibleTenants=accessible_tenants,
        isMspUser=current_user.is_msp_user,
        tenant_assignments=[
            TenantAssignmentResponse(
                tenant_id=assignment.tenant_id,
                tenant_name=assignment.tenant.name if assignment.tenant else None,
                role_id=assignment.role_id,
                role_name=assignment.role.name if assignment.role else None,
                is_primary=assignment.is_primary,
                is_active=assignment.is_active,
                provisioned_via=assignment.provisioned_via,
                external_group_id=assignment.external_group_id,
                external_role_mapping=assignment.external_role_mapping
            ) for assignment in current_user.get_tenant_assignments()
        ]
    )


@router.get("/verify")
def verify_token(current_user: User = Depends(get_current_user)) -> Any:
    """
    Verify if the token is valid
    """
    return {"valid": True}


@router.post("/switch-tenant")
def switch_tenant(
    request: SwitchTenantRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Switch user's current tenant context
    """
    from app.core.permissions import can_user_switch_to_tenant, get_user_permissions_in_tenant
    
    # Check if user can switch to this tenant
    if not can_user_switch_to_tenant(current_user, request.tenant_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this tenant"
        )
    
    # Get role and permissions for the new tenant
    current_role = get_user_role_in_tenant(current_user, request.tenant_id)
    permissions = get_tenant_permissions(current_user, request.tenant_id)
    
    accessible_tenants = get_user_accessible_tenants(current_user, db)
    
    return User(
        id=current_user.user_id,
        name=current_user.full_name,
        email=current_user.email,
        role=current_role,
        tenantId=request.tenant_id,
        permissions=permissions,
        accessibleTenants=accessible_tenants,
        isMspUser=current_user.is_msp_user
    )

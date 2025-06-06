from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session

from app.api.endpoints.auth import get_current_user
from app.db.session import get_db
from app.models.user import User, Tenant
from app.models.sso import SSOProvider
from app.schemas.sso import (
    SSOProviderCreate, SSOProviderUpdate, SSOProviderResponse,
    SSOLoginRequest, SSOLoginResponse, SSOCallbackRequest, SSOCallbackResponse
)
from app.services.azure_ad import AzureADService
from app.core.permissions import has_permission
from app.core.security import create_access_token
from app.core.config import settings
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/providers", response_model=List[SSOProviderResponse])
def get_sso_providers(
    tenant_id: Optional[str] = Query(None, description="Filter by tenant ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Get all SSO providers for the specified tenant
    """
    # Check permissions - only admin and MSP users can view SSO settings
    if not (current_user.role and current_user.role.name in ["admin", "msp"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Use provided tenant_id or default to user's tenant
        target_tenant_id = tenant_id if tenant_id else current_user.tenant_id
        
        # Verify tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == target_tenant_id).first()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tenant with ID {target_tenant_id} not found"
            )
        
        # Check if user has access to this tenant (admin/MSP can access all)
        if current_user.role.name not in ["admin", "msp"] and target_tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view SSO providers for this tenant"
            )
        
        providers = db.query(SSOProvider).filter(
            SSOProvider.tenant_id_fk == target_tenant_id
        ).all()
        
        return [
            SSOProviderResponse(
                id=provider.id,
                provider_id=provider.provider_id,
                name=provider.name,
                provider_type=provider.provider_type,
                is_active=provider.is_active,
                client_id=provider.client_id,
                client_secret="********",  # Always masked
                tenant_id=provider.tenant_id,
                authority=provider.authority,
                discovery_url=provider.discovery_url,
                scim_enabled=provider.scim_enabled,
                scim_base_url=provider.scim_base_url,
                scim_bearer_token="********",  # Always masked
                attribute_mappings=provider.attribute_mappings,
                default_role_id=provider.default_role_id,
                tenant_id_fk=provider.tenant_id_fk,
                created_at=provider.created_at,
                updated_at=provider.updated_at
            ) for provider in providers
        ]
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving SSO providers: {str(e)}"
        )


@router.post("/providers", response_model=SSOProviderResponse)
def create_sso_provider(
    provider: SSOProviderCreate,
    tenant_id: Optional[str] = Query(None, description="Target tenant ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Any:
    """
    Create a new SSO provider for the specified tenant
    """
    # Check permissions - only admin and msp can create SSO providers
    if not (current_user.role and current_user.role.name in ["admin", "msp"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    try:
        # Use provided tenant_id or default to user's tenant
        target_tenant_id = tenant_id if tenant_id else current_user.tenant_id
        
        # Verify tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == target_tenant_id).first()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tenant with ID {target_tenant_id} not found"
            )
        
        # Check if user has access to this tenant (admin/MSP can access all)
        if current_user.role.name not in ["admin", "msp"] and target_tenant_id != current_user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to create SSO providers for this tenant"
            )
        
        # Check if provider already exists for this tenant
        existing_provider = db.query(SSOProvider).filter(
            SSOProvider.tenant_id_fk == target_tenant_id,
            SSOProvider.provider_type == provider.provider_type
        ).first()
        
        if existing_provider:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"SSO provider of type '{provider.provider_type}' already exists for this tenant"
            )
        
        # Create new provider
        new_provider = SSOProvider(
            name=provider.name,
            provider_type=provider.provider_type,
            is_active=provider.is_active,
            client_id=provider.client_id,
            client_secret=provider.client_secret,
            tenant_id=provider.tenant_id,
            authority=provider.authority,
            discovery_url=provider.discovery_url,
            scim_enabled=provider.scim_enabled,
            scim_base_url=provider.scim_base_url,
            scim_bearer_token=provider.scim_bearer_token,
            attribute_mappings=provider.attribute_mappings,
            default_role_id=provider.default_role_id,
            tenant_id_fk=provider.tenant_id_fk
        )
        
        db.add(new_provider)
        db.commit()
        db.refresh(new_provider)
        
        return SSOProviderResponse(
            id=new_provider.id,
            provider_id=new_provider.provider_id,
            name=new_provider.name,
            provider_type=new_provider.provider_type,
            is_active=new_provider.is_active,
            client_id=new_provider.client_id,
            client_secret="********",
            tenant_id=new_provider.tenant_id,
            authority=new_provider.authority,
            discovery_url=new_provider.discovery_url,
            scim_enabled=new_provider.scim_enabled,
            scim_base_url=new_provider.scim_base_url,
            scim_bearer_token="********",
            attribute_mappings=new_provider.attribute_mappings,
            default_role_id=new_provider.default_role_id,
            tenant_id_fk=new_provider.tenant_id_fk,
            created_at=new_provider.created_at,
            updated_at=new_provider.updated_at
        )
    
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating SSO provider: {str(e)}"
        )


@router.post("/login", response_model=SSOLoginResponse)
async def initiate_sso_login(
    login_request: SSOLoginRequest,
    request: Request,
    tenant_id: Optional[str] = Query(None, description="Target tenant ID"),
    db: Session = Depends(get_db)
) -> Any:
    """
    Initiate SSO login flow for the specified tenant
    """
    try:
        # Use tenant_id from query parameter or from request body
        target_tenant_id = tenant_id or login_request.tenant_id
        
        if not target_tenant_id:
            # If no tenant ID provided, use the first available tenant
            first_tenant = db.query(Tenant).filter(Tenant.is_active == True).first()
            if not first_tenant:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="No active tenants found"
                )
            target_tenant_id = first_tenant.tenant_id
            logger.info(f"No tenant ID provided, using first available tenant: {target_tenant_id}")
        
        # Verify tenant exists
        tenant = db.query(Tenant).filter(Tenant.tenant_id == target_tenant_id).first()
        if not tenant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Tenant with ID {target_tenant_id} not found"
            )
        
        # Find SSO provider by type for this specific tenant
        query = db.query(SSOProvider).filter(
            SSOProvider.provider_type == login_request.provider_type,
            SSOProvider.tenant_id_fk == target_tenant_id,
            SSOProvider.is_active == True
        )
        
        # If domain is provided, try to find tenant-specific provider
        if login_request.domain:
            # This is a simplified domain-to-tenant mapping
            # In production, you might want a more sophisticated mapping
            pass
        
        provider = query.first()
        
        if not provider:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No active SSO provider found for type '{login_request.provider_type}'"
            )
        
        # Generate redirect URI
        base_url = str(request.base_url).rstrip('/')
        redirect_uri = login_request.redirect_uri or f"{base_url}/api/sso/callback"
        
        # Initialize Azure AD service
        if provider.provider_type == "azure_ad":
            azure_service = AzureADService(db)
            try:
                authorization_url, state = await azure_service.get_authorization_url(provider, redirect_uri)
                return SSOLoginResponse(
                    authorization_url=authorization_url,
                    state=state
                )
            finally:
                await azure_service.close()
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported SSO provider type: {provider.provider_type}"
            )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error initiating SSO login: {str(e)}"
        )


@router.post("/callback", response_model=SSOCallbackResponse)
async def handle_sso_callback(
    callback_request: SSOCallbackRequest,
    request: Request,
    db: Session = Depends(get_db)
) -> Any:
    """
    Handle SSO callback after user authentication
    """
    try:
        # Find SSO provider
        provider = db.query(SSOProvider).filter(
            SSOProvider.provider_type == callback_request.provider_type,
            SSOProvider.is_active == True
        ).first()
        
        if not provider:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No active SSO provider found for type '{callback_request.provider_type}'"
            )
        
        # Generate redirect URI (should match the one used in login)
        base_url = str(request.base_url).rstrip('/')
        redirect_uri = f"{base_url}/api/sso/callback"
        
        # Handle Azure AD callback
        if provider.provider_type == "azure_ad":
            azure_service = AzureADService(db)
            try:
                # Exchange code for tokens
                tokens = await azure_service.exchange_code_for_tokens(
                    provider, callback_request.code, redirect_uri
                )
                
                # Get user info
                user_info = await azure_service.get_user_info(tokens["access_token"])
                
                # Get user groups
                groups = await azure_service.get_user_groups(tokens["access_token"])
                
                # Find or create user
                user = azure_service.find_or_create_user(user_info, provider, groups)
                is_new_user = user.is_sso_user and not user.individual_permissions
                
                # Create SSO session
                azure_service.create_sso_session(user, provider, tokens)
                
                # Generate internal access token
                access_token = create_access_token(subject=str(user.user_id))
                
                # Get user permissions
                from app.core.permissions import get_user_permissions
                all_permissions = list(get_user_permissions(user, db))
                individual_permissions = []
                if user.individual_permissions:
                    individual_permissions = [p.name for p in user.individual_permissions]
                
                # Prepare user data
                user_data = {
                    "id": user.id,
                    "user_id": user.user_id,
                    "username": user.username,
                    "full_name": user.full_name,
                    "email": user.email,
                    "role": user.role.name if user.role else "user",
                    "tenantId": user.tenant.tenant_id if user.tenant else "",
                    "permissions": all_permissions,
                    "individual_permissions": individual_permissions,
                    "is_sso_user": True,
                    "sso_provider": "azure_ad"
                }
                
                return SSOCallbackResponse(
                    user=user_data,
                    token=access_token,
                    token_type="bearer",
                    is_new_user=is_new_user
                )
            
            finally:
                await azure_service.close()
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported SSO provider type: {provider.provider_type}"
            )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error handling SSO callback: {str(e)}"
        )

"""
Azure AD SSO integration service.

This module provides functions to integrate with Azure AD for SSO authentication
using OAuth2/OIDC protocols.
"""

import json
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple, List
from urllib.parse import urlencode, parse_qs, urlparse
import httpx
from sqlalchemy.orm import Session

from app.models.sso import SSOProvider, SSOUserMapping, SSOSession
from app.models.user import User, Role, Tenant
from app.core.security import get_password_hash, create_access_token
from app.core.config import settings


class AzureADService:
    """Service for Azure AD SSO integration"""
    
    def __init__(self, db: Session):
        self.db = db
        self.client = httpx.AsyncClient()
    
    async def get_authorization_url(self, provider: SSOProvider, redirect_uri: str) -> Tuple[str, str]:
        """
        Generate Azure AD authorization URL for SSO login.
        
        Args:
            provider: SSO provider configuration
            redirect_uri: Callback URL after authentication
            
        Returns:
            Tuple of (authorization_url, state)
        """
        # Generate random state for CSRF protection
        state = secrets.token_urlsafe(32)
        
        # Azure AD authorization endpoint
        if provider.authority:
            auth_endpoint = f"{provider.authority}/oauth2/v2.0/authorize"
        else:
            auth_endpoint = f"https://login.microsoftonline.com/{provider.tenant_id}/oauth2/v2.0/authorize"
        
        # OAuth2 parameters
        params = {
            "client_id": provider.client_id,
            "response_type": "code",
            "redirect_uri": redirect_uri,
            "scope": "openid profile email User.Read",
            "state": state,
            "response_mode": "query"
        }
        
        authorization_url = f"{auth_endpoint}?{urlencode(params)}"
        
        return authorization_url, state
    
    async def exchange_code_for_tokens(self, provider: SSOProvider, code: str, redirect_uri: str) -> Dict[str, Any]:
        """
        Exchange authorization code for access tokens.
        
        Args:
            provider: SSO provider configuration
            code: Authorization code from Azure AD
            redirect_uri: Callback URL used in authorization
            
        Returns:
            Token response from Azure AD
        """
        # Azure AD token endpoint
        if provider.authority:
            token_endpoint = f"{provider.authority}/oauth2/v2.0/token"
        else:
            token_endpoint = f"https://login.microsoftonline.com/{provider.tenant_id}/oauth2/v2.0/token"
        
        # Token request data
        data = {
            "client_id": provider.client_id,
            "client_secret": provider.client_secret,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": redirect_uri,
            "scope": "openid profile email User.Read"
        }
        
        # Make token request
        response = await self.client.post(
            token_endpoint,
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"}
        )
        
        if response.status_code != 200:
            raise Exception(f"Token exchange failed: {response.text}")
        
        return response.json()
    
    async def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """
        Get user information from Microsoft Graph API.
        
        Args:
            access_token: Access token from Azure AD
            
        Returns:
            User information from Microsoft Graph
        """
        # Microsoft Graph user endpoint
        user_endpoint = "https://graph.microsoft.com/v1.0/me"
        
        # Make user info request
        response = await self.client.get(
            user_endpoint,
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        if response.status_code != 200:
            raise Exception(f"User info request failed: {response.text}")
        
        return response.json()
    
    async def get_user_groups(self, access_token: str) -> List[Dict[str, Any]]:
        """
        Get user's group memberships from Microsoft Graph API.
        
        Args:
            access_token: Access token from Azure AD
            
        Returns:
            List of groups the user is a member of
        """
        # Microsoft Graph groups endpoint
        groups_endpoint = "https://graph.microsoftonline.com/v1.0/me/memberOf"
        
        # Make groups request
        response = await self.client.get(
            groups_endpoint,
            headers={"Authorization": f"Bearer {access_token}"}
        )
        
        if response.status_code != 200:
            raise Exception(f"Groups request failed: {response.text}")
        
        groups_data = response.json()
        return groups_data.get("value", [])
    
    def map_azure_user_to_internal(self, azure_user: Dict[str, Any], provider: SSOProvider) -> Dict[str, Any]:
        """
        Map Azure AD user attributes to internal user fields.
        
        Args:
            azure_user: User data from Azure AD
            provider: SSO provider with attribute mappings
            
        Returns:
            Mapped user data for internal user creation
        """
        # Default attribute mappings
        default_mappings = {
            "username": "userPrincipalName",
            "email": "mail",
            "full_name": "displayName",
            "first_name": "givenName",
            "last_name": "surname"
        }
        
        # Use provider-specific mappings if available
        mappings = provider.attribute_mappings or default_mappings
        
        # Map attributes
        mapped_user = {}
        for internal_field, azure_field in mappings.items():
            if azure_field in azure_user:
                mapped_user[internal_field] = azure_user[azure_field]
        
        # Ensure required fields have fallback values
        if "username" not in mapped_user and "userPrincipalName" in azure_user:
            mapped_user["username"] = azure_user["userPrincipalName"]
        
        if "email" not in mapped_user:
            if "mail" in azure_user and azure_user["mail"]:
                mapped_user["email"] = azure_user["mail"]
            elif "userPrincipalName" in azure_user:
                mapped_user["email"] = azure_user["userPrincipalName"]
        
        if "full_name" not in mapped_user and "displayName" in azure_user:
            mapped_user["full_name"] = azure_user["displayName"]
        
        return mapped_user
    
    def find_or_create_user(self, azure_user: Dict[str, Any], provider: SSOProvider, groups: List[Dict[str, Any]]) -> User:
        """
        Find existing user or create new user from Azure AD data.
        
        Args:
            azure_user: User data from Azure AD
            provider: SSO provider configuration
            groups: User's group memberships
            
        Returns:
            Internal user object
        """
        # Map Azure user to internal fields
        mapped_user = self.map_azure_user_to_internal(azure_user, provider)
        
        # Check if user mapping already exists
        external_user_id = azure_user.get("id")
        external_email = mapped_user.get("email")
        
        user_mapping = self.db.query(SSOUserMapping).filter(
            SSOUserMapping.provider_id == provider.id,
            SSOUserMapping.external_user_id == external_user_id
        ).first()
        
        if user_mapping:
            # Update existing mapping
            user = user_mapping.internal_user
            user_mapping.external_email = external_email
            user_mapping.external_username = mapped_user.get("username")
            user_mapping.external_display_name = mapped_user.get("full_name")
            user_mapping.external_groups = [g.get("displayName") for g in groups]
            user_mapping.last_sync_at = datetime.utcnow()
            
            # Update user information
            if external_email and user.email != external_email:
                user.email = external_email
            if mapped_user.get("full_name") and user.full_name != mapped_user.get("full_name"):
                user.full_name = mapped_user.get("full_name")
            
            self.db.commit()
            return user
        
        # Check if user exists by email
        existing_user = self.db.query(User).filter(User.email == external_email).first()
        
        if existing_user:
            # Create mapping for existing user
            user_mapping = SSOUserMapping(
                provider_id=provider.id,
                external_user_id=external_user_id,
                external_email=external_email,
                external_username=mapped_user.get("username"),
                external_display_name=mapped_user.get("full_name"),
                external_groups=[g.get("displayName") for g in groups],
                internal_user_id=existing_user.id
            )
            
            # Update user to mark as SSO user
            existing_user.is_sso_user = True
            existing_user.sso_provider = "azure_ad"
            existing_user.sso_user_id = external_user_id
            existing_user.sso_email = external_email
            
            self.db.add(user_mapping)
            self.db.commit()
            return existing_user
        
        # Create new user
        # Determine role based on groups or use default
        role = None
        if provider.default_role_id:
            role = self.db.query(Role).filter(Role.id == provider.default_role_id).first()
        
        if not role:
            # Use default user role
            role = self.db.query(Role).filter(Role.name == "user").first()
        
        # Create user
        new_user = User(
            user_id=str(uuid.uuid4()),
            username=mapped_user.get("username", external_email),
            full_name=mapped_user.get("full_name", ""),
            email=external_email,
            hashed_password=get_password_hash(secrets.token_urlsafe(32)),  # Random password for SSO users
            is_active=True,
            is_sso_user=True,
            sso_provider="azure_ad",
            sso_user_id=external_user_id,
            sso_email=external_email,
            role_id=role.id if role else None,
            tenant_id=provider.tenant_id_fk
        )
        
        self.db.add(new_user)
        self.db.flush()  # Get user ID
        
        # Create user mapping
        user_mapping = SSOUserMapping(
            provider_id=provider.id,
            external_user_id=external_user_id,
            external_email=external_email,
            external_username=mapped_user.get("username"),
            external_display_name=mapped_user.get("full_name"),
            external_groups=[g.get("displayName") for g in groups],
            internal_user_id=new_user.id
        )
        
        self.db.add(user_mapping)
        self.db.commit()
        
        return new_user
    
    def create_sso_session(self, user: User, provider: SSOProvider, tokens: Dict[str, Any]) -> SSOSession:
        """
        Create SSO session record.
        
        Args:
            user: Internal user object
            provider: SSO provider configuration
            tokens: Token response from Azure AD
            
        Returns:
            SSO session object
        """
        session = SSOSession(
            user_id=user.id,
            provider_id=provider.id,
            access_token=tokens.get("access_token"),
            refresh_token=tokens.get("refresh_token"),
            id_token=tokens.get("id_token"),
            expires_at=datetime.utcnow() + timedelta(seconds=tokens.get("expires_in", 3600))
        )
        
        self.db.add(session)
        self.db.commit()
        
        return session
    
    async def close(self):
        """Close HTTP client"""
        await self.client.aclose()

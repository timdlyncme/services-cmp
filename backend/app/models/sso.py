from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy import ForeignKey
import datetime

from app.models.base_models import Base, generate_uuid


class SSOProvider(Base):
    """SSO Provider configuration"""
    __tablename__ = "sso_providers"
    
    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    name = Column(String, nullable=False)  # e.g., "Azure AD", "Google", "Okta"
    provider_type = Column(String, nullable=False)  # e.g., "azure_ad", "google", "okta"
    is_active = Column(Boolean, default=True)
    
    # Provider-specific configuration
    client_id = Column(String, nullable=False)
    client_secret = Column(String, nullable=False)  # Should be encrypted in production
    tenant_id = Column(String, nullable=True)  # For Azure AD
    authority = Column(String, nullable=True)  # OAuth2 authority URL
    discovery_url = Column(String, nullable=True)  # OIDC discovery URL
    
    # SCIM configuration
    scim_enabled = Column(Boolean, default=False)
    scim_base_url = Column(String, nullable=True)
    scim_bearer_token = Column(String, nullable=True)  # Should be encrypted in production
    
    # User attribute mappings (JSON field)
    attribute_mappings = Column(JSON, nullable=True)  # Maps SSO attributes to internal fields
    
    # Default role assignment
    default_role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    default_role = relationship("Role")
    
    # Tenant association
    tenant_id_fk = Column(UUID(as_uuid=False), ForeignKey("tenants.tenant_id"))
    tenant = relationship("Tenant")
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    user_mappings = relationship("SSOUserMapping", back_populates="provider")


class SSOUserMapping(Base):
    """Maps SSO users to internal users"""
    __tablename__ = "sso_user_mappings"
    
    id = Column(Integer, primary_key=True, index=True)
    mapping_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    
    # SSO provider information
    provider_id = Column(Integer, ForeignKey("sso_providers.id"), nullable=False)
    provider = relationship("SSOProvider", back_populates="user_mappings")
    
    # External user information
    external_user_id = Column(String, nullable=False)  # User ID from SSO provider
    external_email = Column(String, nullable=False)
    external_username = Column(String, nullable=True)
    external_display_name = Column(String, nullable=True)
    
    # Internal user mapping
    internal_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    internal_user = relationship("User")
    
    # Group memberships from SSO provider
    external_groups = Column(JSON, nullable=True)  # List of group names/IDs from SSO
    
    # Provisioning information
    provisioned_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_login_at = Column(DateTime, nullable=True)
    last_sync_at = Column(DateTime, nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    sync_enabled = Column(Boolean, default=True)
    
    # Unique constraint on provider + external user
    __table_args__ = (
        {"schema": None},  # Use default schema
    )


class SSOSession(Base):
    """Tracks SSO login sessions"""
    __tablename__ = "sso_sessions"
    
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    
    # User and provider information
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User")
    
    provider_id = Column(Integer, ForeignKey("sso_providers.id"), nullable=False)
    provider = relationship("SSOProvider")
    
    # Session details
    external_session_id = Column(String, nullable=True)  # Session ID from SSO provider
    access_token = Column(Text, nullable=True)  # Should be encrypted in production
    refresh_token = Column(Text, nullable=True)  # Should be encrypted in production
    id_token = Column(Text, nullable=True)  # OIDC ID token
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    last_used_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    # Status
    is_active = Column(Boolean, default=True)


class SCIMLog(Base):
    """Logs SCIM provisioning events"""
    __tablename__ = "scim_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    log_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    
    # Provider information
    provider_id = Column(Integer, ForeignKey("sso_providers.id"), nullable=False)
    provider = relationship("SSOProvider")
    
    # Event details
    event_type = Column(String, nullable=False)  # CREATE, UPDATE, DELETE, etc.
    resource_type = Column(String, nullable=False)  # User, Group
    external_resource_id = Column(String, nullable=True)
    internal_resource_id = Column(String, nullable=True)
    
    # Request/response data
    request_data = Column(JSON, nullable=True)
    response_data = Column(JSON, nullable=True)
    
    # Status
    status = Column(String, nullable=False)  # SUCCESS, ERROR, PENDING
    error_message = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)


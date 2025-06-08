from sqlalchemy import Column, Integer, String, ForeignKey, Table, Boolean, DateTime, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import datetime

from app.models.base_models import Base, generate_uuid


# Association table for many-to-many relationship between Role and Permission
role_permission = Table(
    "role_permission",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("roles.id"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id"), primary_key=True)
)


class Permission(Base):
    __tablename__ = "permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(String, nullable=True)
    scope = Column(String, default="tenant", nullable=False)  # "tenant" or "global"
    
    # Relationships
    roles = relationship("Role", secondary=role_permission, back_populates="permissions")


class Role(Base):
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(String, nullable=True)
    
    # Relationships
    permissions = relationship("Permission", secondary=role_permission, back_populates="roles")
    users = relationship("User", back_populates="role")


class Tenant(Base):
    __tablename__ = "tenants"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    name = Column(String)
    description = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    date_created = Column(DateTime, default=datetime.datetime.utcnow)
    date_modified = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # SSO_FUTURE: Domain-based tenant resolution for SSO login flows
    # This will enable automatic tenant detection from user email domains (e.g., user@company.com -> tenant)
    primary_domain = Column(String, nullable=True, index=True)
    
    # Relationships
    user_assignments = relationship("UserTenantAssignment", back_populates="tenant")  # Multi-tenant relationship
    
    # ... existing relationships ...

    # Relationship with TemplateFoundry
    template_foundry_items = relationship("TemplateFoundry", back_populates="tenant")
    
    # Relationship with IntegrationConfig
    integration_configs = relationship("IntegrationConfig", back_populates="tenant")
    
    # Relationship with AI Assistant
    ai_assistant_configs = relationship("AIAssistantConfig", back_populates="tenant")
    ai_assistant_logs = relationship("AIAssistantLog", back_populates="tenant")


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    username = Column(String, unique=True, index=True)
    full_name = Column(String)
    email = Column(String, index=True)  # Removed unique=True for SSO compatibility
    
    # SSO_FUTURE: Password becomes optional for SSO-only users
    # SSO users won't have local passwords, only external identity provider authentication
    hashed_password = Column(String, nullable=True)  # Changed from required to optional
    
    is_active = Column(Boolean, default=True)
    is_msp_user = Column(Boolean, default=False)  # Flag to identify MSP users
    
    # SSO_FUTURE: External identity provider integration fields
    # These fields will store Azure AD/OAuth2.0 user information for SSO authentication
    external_id = Column(String, unique=True, nullable=True, index=True)  # Azure AD Object ID
    identity_provider = Column(String, default="local", nullable=False)  # "local", "azure_ad", "saml", etc.
    
    # Relationships
    role_id = Column(Integer, ForeignKey("roles.id"))
    role = relationship("Role", back_populates="users")
    
    # Multi-tenant relationship - this is now the ONLY way users are assigned to tenants
    tenant_assignments = relationship("UserTenantAssignment", back_populates="user")
    
    # Relationship with Deployment
    deployments = relationship("Deployment", back_populates="created_by")
    
    # Relationship with TemplateFoundry
    template_foundry_items = relationship("TemplateFoundry", back_populates="created_by")
    
    # Relationship with Dashboard
    dashboards = relationship("Dashboard", back_populates="user")
    
    # SSO_FUTURE: Email uniqueness will be enforced per tenant via user_tenant_assignments
    # This allows the same email to exist across multiple tenants (common in SSO scenarios)
    __table_args__ = (
        # Email uniqueness is now handled through tenant assignments, not globally
        # This enables SSO users to exist in multiple tenants with the same email
    )
    
    def get_tenant_assignments(self):
        """Get all active tenant assignments for this user"""
        return [assignment for assignment in self.tenant_assignments if assignment.is_active]
    
    def get_primary_tenant_assignment(self):
        """Get the user's primary tenant assignment"""
        for assignment in self.tenant_assignments:
            if assignment.is_primary and assignment.is_active:
                return assignment
        return None
    
    def get_primary_tenant_id(self):
        """Get the user's primary tenant ID - replaces direct tenant_id access"""
        primary_assignment = self.get_primary_tenant_assignment()
        return primary_assignment.tenant_id if primary_assignment else None
    
    def has_tenant_access(self, tenant_id: str) -> bool:
        """Check if user has access to a specific tenant"""
        if self.is_msp_user:
            return True  # MSP users have access to all tenants
        
        for assignment in self.tenant_assignments:
            if assignment.is_active and assignment.tenant_id == tenant_id:
                return True
        return False
    
    def get_role_in_tenant(self, tenant_id: str):
        """Get the user's role in a specific tenant"""
        for assignment in self.tenant_assignments:
            if assignment.is_active and assignment.tenant_id == tenant_id:
                return assignment.role
        return None
    
    # SSO_FUTURE: Additional methods for SSO user management
    def is_sso_user(self) -> bool:
        """Check if user authenticates via SSO"""
        return self.identity_provider != "local"
    
    def can_login_locally(self) -> bool:
        """Check if user can authenticate with local password"""
        return self.hashed_password is not None

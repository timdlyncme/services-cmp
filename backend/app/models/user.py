from sqlalchemy import Column, Integer, String, ForeignKey, Table, Boolean, DateTime
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
    
    # Relationships
    users = relationship("User", back_populates="tenant")  # Keep for backward compatibility
    user_assignments = relationship("UserTenantAssignment", back_populates="tenant")  # New multi-tenant relationship
    
    # ... existing relationships ...

    # Relationship with TemplateFoundry
    template_foundry_items = relationship("TemplateFoundry", back_populates="tenant")
    
    # Relationship with IntegrationConfig
    integration_configs = relationship("IntegrationConfig", back_populates="tenant")
    
    # Relationship with AI Assistant
    ai_assistant_configs = relationship("AIAssistantConfig", back_populates="tenant")
    ai_assistant_logs = relationship("AIAssistantLog", back_populates="tenant")


class UserTenantAssignment(Base):
    """Many-to-many relationship between users and tenants with additional metadata"""
    __tablename__ = "user_tenant_assignments"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    tenant_id = Column(UUID(as_uuid=False), ForeignKey("tenants.tenant_id"), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    is_primary = Column(Boolean, default=False, nullable=False)  # Primary tenant for the user
    is_active = Column(Boolean, default=True, nullable=False)
    date_created = Column(DateTime, default=datetime.datetime.utcnow)
    date_modified = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="tenant_assignments")
    tenant = relationship("Tenant", back_populates="user_assignments")
    role = relationship("Role")
    
    # Unique constraint to prevent duplicate assignments
    __table_args__ = (
        # Ensure a user can only have one assignment per tenant
        # and only one primary tenant assignment
    )


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    username = Column(String, unique=True, index=True)
    full_name = Column(String)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    is_msp_user = Column(Boolean, default=False)  # Flag to identify MSP users
    
    # Relationships
    role_id = Column(Integer, ForeignKey("roles.id"))
    role = relationship("Role", back_populates="users")
    
    # Keep existing single tenant relationship for backward compatibility
    tenant_id = Column(UUID(as_uuid=False), ForeignKey("tenants.tenant_id"))
    tenant = relationship("Tenant", back_populates="users")
    
    # New multi-tenant relationship
    tenant_assignments = relationship("UserTenantAssignment", back_populates="user")
    
    # Relationship with Deployment
    deployments = relationship("Deployment", back_populates="created_by")
    
    # Relationship with TemplateFoundry
    template_foundry_items = relationship("TemplateFoundry", back_populates="created_by")
    
    # Relationship with Dashboard
    dashboards = relationship("Dashboard", back_populates="user")
    
    # ... existing methods ...
    
    def get_tenant_assignments(self):
        """Get all active tenant assignments for this user"""
        return [assignment for assignment in self.tenant_assignments if assignment.is_active]
    
    def get_primary_tenant_assignment(self):
        """Get the user's primary tenant assignment"""
        for assignment in self.tenant_assignments:
            if assignment.is_primary and assignment.is_active:
                return assignment
        return None
    
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

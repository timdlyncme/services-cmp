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
    users = relationship("User", back_populates="tenant")
    
    # These relationships will be added by the respective models
    # cloud_accounts = relationship("CloudAccount", back_populates="tenant")
    # environments = relationship("Environment", back_populates="tenant")
    # templates = relationship("Template", back_populates="tenant")
    # deployments = relationship("Deployment", back_populates="tenant")
    
    # Relationship with TemplateFoundry
    template_foundry_items = relationship("TemplateFoundry", back_populates="tenant")
    
    # Relationship with IntegrationConfig
    integration_configs = relationship("IntegrationConfig", back_populates="tenant")
    
    # Relationship with Dashboard
    dashboards = relationship("Dashboard", back_populates="tenant")


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    username = Column(String, unique=True, index=True)
    full_name = Column(String)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    role_id = Column(Integer, ForeignKey("roles.id"))
    role = relationship("Role", back_populates="users")
    
    tenant_id = Column(UUID(as_uuid=False), ForeignKey("tenants.tenant_id"))  # Changed to UUID type
    tenant = relationship("Tenant", back_populates="users")
    
    # Relationship with Deployment
    deployments = relationship("Deployment", back_populates="created_by")
    
    # Relationship with TemplateFoundry
    template_foundry_items = relationship("TemplateFoundry", back_populates="created_by")
    
    # Relationship with Dashboard
    dashboards = relationship("Dashboard", back_populates="created_by")

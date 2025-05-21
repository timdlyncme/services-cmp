from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, Table
from sqlalchemy.orm import relationship

from app.models.base_models import Base


# Association table for many-to-many relationship between Role and Permission
role_permission = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("roles.id"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permissions.id"), primary_key=True)
)


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    full_name = Column(String)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    role_id = Column(Integer, ForeignKey("roles.id"))
    role = relationship("Role", back_populates="users")
    
    tenant_id = Column(Integer, ForeignKey("tenants.id"))
    tenant = relationship("Tenant", back_populates="users")
    
    # Relationship with deployments
    deployments = relationship("Deployment", back_populates="created_by")
    
    # Relationship with template foundry
    template_foundry_items = relationship("TemplateFoundry", back_populates="created_by")


class Role(Base):
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    description = Column(String, nullable=True)
    
    # Relationships
    users = relationship("User", back_populates="role")
    permissions = relationship("Permission", secondary="role_permissions")


class Permission(Base):
    __tablename__ = "permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True)
    description = Column(String, nullable=True)


class Tenant(Base):
    __tablename__ = "tenants"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, unique=True, index=True)
    name = Column(String)
    description = Column(String, nullable=True)
    
    # Relationships
    users = relationship("User", back_populates="tenant")
    integration_configs = relationship("IntegrationConfig", back_populates="tenant")
    template_foundry_items = relationship("TemplateFoundry", back_populates="tenant")

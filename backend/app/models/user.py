from sqlalchemy import Column, Integer, String, ForeignKey, Table
from sqlalchemy.orm import relationship

from app.models.base_models import Base


# Association table for many-to-many relationship between roles and permissions
role_permission = Table(
    "role_permission",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("roles.id")),
    Column("permission_id", Integer, ForeignKey("permissions.id"))
)


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    
    # Relationships
    role_id = Column(Integer, ForeignKey("roles.id"))
    role = relationship("Role", back_populates="users")
    
    tenant_id = Column(Integer, ForeignKey("tenants.id"))
    tenant = relationship("Tenant", back_populates="users")
    
    # Use string reference to avoid circular import
    deployments = relationship("Deployment", back_populates="created_by")


class Role(Base):
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(String, nullable=True)
    
    # Relationships
    users = relationship("User", back_populates="role")
    permissions = relationship(
        "Permission",
        secondary=role_permission,
        back_populates="roles"
    )


class Permission(Base):
    __tablename__ = "permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(String, nullable=True)
    
    # Relationships
    roles = relationship(
        "Role",
        secondary=role_permission,
        back_populates="permissions"
    )


class Tenant(Base):
    __tablename__ = "tenants"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, unique=True, index=True)
    name = Column(String)
    description = Column(String, nullable=True)
    
    # Relationships
    users = relationship("User", back_populates="tenant")
    
    # Use string references to avoid circular imports
    cloud_accounts = relationship("CloudAccount", back_populates="tenant")
    environments = relationship("Environment", back_populates="tenant")
    templates = relationship("Template", back_populates="tenant")
    deployments = relationship("Deployment", back_populates="tenant")
    integration_configs = relationship("IntegrationConfig", back_populates="tenant")

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Table, Text
from sqlalchemy.orm import relationship

from app.db.session import Base

# Association table for user permissions
user_permissions = Table(
    "user_permissions",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id")),
    Column("permission_id", Integer, ForeignKey("permissions.id")),
)

# Association table for role permissions
role_permissions = Table(
    "role_permissions",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("roles.id")),
    Column("permission_id", Integer, ForeignKey("permissions.id")),
)


class Tenant(Base):
    __tablename__ = "tenants"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, unique=True, index=True)
    name = Column(String, index=True)
    description = Column(Text, nullable=True)
    
    # Relationships
    users = relationship("User", back_populates="tenant")


class Role(Base):
    __tablename__ = "roles"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(Text, nullable=True)
    
    # Relationships
    users = relationship("User", back_populates="role")
    permissions = relationship(
        "Permission",
        secondary=role_permissions,
        back_populates="roles"
    )


class Permission(Base):
    __tablename__ = "permissions"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(Text, nullable=True)
    
    # Relationships
    roles = relationship(
        "Role",
        secondary=role_permissions,
        back_populates="permissions"
    )
    users = relationship(
        "User",
        secondary=user_permissions,
        back_populates="permissions"
    )


class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, unique=True, index=True)
    name = Column(String, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    
    # Foreign keys
    role_id = Column(Integer, ForeignKey("roles.id"))
    tenant_id = Column(Integer, ForeignKey("tenants.id"))
    
    # Relationships
    role = relationship("Role", back_populates="users")
    tenant = relationship("Tenant", back_populates="users")
    permissions = relationship(
        "Permission",
        secondary=user_permissions,
        back_populates="users"
    )


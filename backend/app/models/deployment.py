from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime, Table
from sqlalchemy.orm import relationship
from datetime import datetime

from app.db.session import Base


class CloudAccount(Base):
    __tablename__ = "cloud_accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(String, unique=True, index=True)
    name = Column(String)
    provider = Column(String)  # azure, aws, gcp
    status = Column(String)  # connected, warning, error, pending
    description = Column(String, nullable=True)
    
    # Relationships
    tenant_id = Column(Integer, ForeignKey("tenants.id"))
    tenant = relationship("Tenant", back_populates="cloud_accounts")
    
    deployments = relationship("Deployment", back_populates="cloud_account")


class Environment(Base):
    __tablename__ = "environments"
    
    id = Column(Integer, primary_key=True, index=True)
    environment_id = Column(String, unique=True, index=True)
    name = Column(String)
    description = Column(String, nullable=True)
    
    # Relationships
    tenant_id = Column(Integer, ForeignKey("tenants.id"))
    tenant = relationship("Tenant", back_populates="environments")
    
    deployments = relationship("Deployment", back_populates="environment")


class Template(Base):
    __tablename__ = "templates"
    
    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(String, unique=True, index=True)
    name = Column(String)
    description = Column(String, nullable=True)
    category = Column(String)
    provider = Column(String)  # azure, aws, gcp
    is_public = Column(Boolean, default=False)
    
    # Relationships - tenant is null for public templates
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    tenant = relationship("Tenant", back_populates="templates")
    
    deployments = relationship("Deployment", back_populates="template")


class Deployment(Base):
    __tablename__ = "deployments"
    
    id = Column(Integer, primary_key=True, index=True)
    deployment_id = Column(String, unique=True, index=True)
    name = Column(String)
    status = Column(String)  # running, succeeded, failed, pending
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    template_id = Column(Integer, ForeignKey("templates.id"))
    template = relationship("Template", back_populates="deployments")
    
    environment_id = Column(Integer, ForeignKey("environments.id"))
    environment = relationship("Environment", back_populates="deployments")
    
    cloud_account_id = Column(Integer, ForeignKey("cloud_accounts.id"))
    cloud_account = relationship("CloudAccount", back_populates="deployments")
    
    tenant_id = Column(Integer, ForeignKey("tenants.id"))
    tenant = relationship("Tenant", back_populates="deployments")
    
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_by = relationship("User", back_populates="deployments")


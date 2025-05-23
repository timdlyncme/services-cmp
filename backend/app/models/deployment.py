from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime, Table, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime

from app.models.base_models import Base, generate_uuid


# Association table for many-to-many relationship between Environment and CloudAccount
environment_cloud_account = Table(
    "environment_cloud_account",
    Base.metadata,
    Column("environment_id", Integer, ForeignKey("environments.id"), primary_key=True),
    Column("cloud_account_id", Integer, ForeignKey("cloud_accounts.id"), primary_key=True)
)


class CloudAccount(Base):
    __tablename__ = "cloud_accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    name = Column(String)
    provider = Column(String)  # azure, aws, gcp
    status = Column(String)  # connected, disconnected, error
    description = Column(String, nullable=True)
    
    # Relationships
    tenant_id = Column(UUID(as_uuid=False), ForeignKey("tenants.tenant_id"))  # Changed to UUID type
    tenant = relationship("Tenant", back_populates="cloud_accounts")
    
    # Many-to-many relationship with Environment
    environments = relationship(
        "Environment",
        secondary=environment_cloud_account,
        back_populates="cloud_accounts"
    )


class Environment(Base):
    __tablename__ = "environments"
    
    id = Column(Integer, primary_key=True, index=True)
    environment_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    name = Column(String)
    description = Column(String, nullable=True)
    
    # New fields
    update_strategy = Column(String, nullable=True)  # rolling, blue-green, canary
    scaling_policies = Column(JSON, nullable=True)
    environment_variables = Column(JSON, nullable=True)
    logging_config = Column(JSON, nullable=True)
    monitoring_integration = Column(JSON, nullable=True)
    
    # Relationships
    tenant_id = Column(UUID(as_uuid=False), ForeignKey("tenants.tenant_id"))  # Changed to UUID type
    tenant = relationship("Tenant", back_populates="environments")
    
    deployments = relationship("Deployment", back_populates="environment")
    
    # Many-to-many relationship with CloudAccount
    cloud_accounts = relationship(
        "CloudAccount",
        secondary=environment_cloud_account,
        back_populates="environments"
    )


class Template(Base):
    __tablename__ = "templates"
    
    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    name = Column(String)
    description = Column(String, nullable=True)
    category = Column(String, nullable=True)
    provider = Column(String)  # azure, aws, gcp
    is_public = Column(Boolean, default=False)
    current_version = Column(String, nullable=True)
    code = Column(String, nullable=True)  # Store the template code directly
    parameters = Column(JSON, nullable=True)  # Store template parameters
    variables = Column(JSON, nullable=True)  # Store template variables
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    tenant_id = Column(UUID(as_uuid=False), ForeignKey("tenants.tenant_id"))  # Changed to UUID type
    tenant = relationship("Tenant", back_populates="templates")
    
    deployments = relationship("Deployment", back_populates="template")
    
    # Relationship with TemplateVersion
    versions = relationship("TemplateVersion", back_populates="template")


class TemplateVersion(Base):
    __tablename__ = "template_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    version = Column(String)
    changes = Column(String, nullable=True)
    code = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    template_id = Column(Integer, ForeignKey("templates.id"))
    template = relationship("Template", back_populates="versions")
    
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_by = relationship("User")


class Deployment(Base):
    __tablename__ = "deployments"
    
    id = Column(Integer, primary_key=True, index=True)
    deployment_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    name = Column(String)
    description = Column(String, nullable=True)
    status = Column(String)  # pending, running, completed, failed
    parameters = Column(JSON, nullable=True)
    resources = Column(JSON, nullable=True)  # Store deployment resources
    region = Column(String, nullable=True)  # Store deployment region
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    tenant_id = Column(UUID(as_uuid=False), ForeignKey("tenants.tenant_id"))  # Changed to UUID type
    tenant = relationship("Tenant", back_populates="deployments")
    
    environment_id = Column(Integer, ForeignKey("environments.id"))
    environment = relationship("Environment", back_populates="deployments")
    
    template_id = Column(Integer, ForeignKey("templates.id"))
    template = relationship("Template", back_populates="deployments")
    
    # Add relationship with User
    created_by_id = Column(Integer, ForeignKey("users.id"))
    created_by = relationship("User", back_populates="deployments")
    
    # Relationship with DeploymentHistory
    history = relationship("DeploymentHistory", back_populates="deployment")


class DeploymentHistory(Base):
    __tablename__ = "deployment_history"
    
    id = Column(Integer, primary_key=True, index=True)
    status = Column(String)  # pending, in_progress, completed, failed
    message = Column(String, nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    deployment_id = Column(Integer, ForeignKey("deployments.id"))
    deployment = relationship("Deployment", back_populates="history")
    
    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User")


# Add relationships to Tenant model
from app.models.user import Tenant
Tenant.cloud_accounts = relationship("CloudAccount", back_populates="tenant")
Tenant.environments = relationship("Environment", back_populates="tenant")
Tenant.templates = relationship("Template", back_populates="tenant")
Tenant.deployments = relationship("Deployment", back_populates="tenant")

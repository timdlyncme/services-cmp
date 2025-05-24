from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.base_class import Base
from app.utils.uuid import generate_uuid

class DeploymentDetails(Base):
    __tablename__ = "deployment_details"
    
    id = Column(Integer, primary_key=True, index=True)
    deployment_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    
    # Deployment information
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    status = Column(String)  # pending, running, completed, failed, deleted
    
    # Cloud information
    provider = Column(String)  # azure, aws, gcp
    cloud_account_id = Column(Integer, ForeignKey("cloud_accounts.id"))
    cloud_account = relationship("CloudAccount", backref="deployments")
    
    # Template information
    template_id = Column(Integer, ForeignKey("templates.id"), nullable=True)
    template = relationship("Template", backref="deployments")
    template_url = Column(String, nullable=True)  # URL to template if not using stored template
    template_code = Column(Text, nullable=True)  # Raw template code if provided directly
    template_type = Column(String)  # terraform, arm, cloudformation, etc.
    
    # Environment information
    environment_id = Column(Integer, ForeignKey("environments.id"))
    environment = relationship("Environment", backref="deployments")
    
    # Deployment parameters and outputs
    parameters = Column(JSON, nullable=True)  # Input parameters for the deployment
    variables = Column(JSON, nullable=True)  # Variables used in the deployment
    outputs = Column(JSON, nullable=True)  # Outputs from the deployment
    resources = Column(JSON, nullable=True)  # Resources created by the deployment
    
    # Deployment logs
    logs = Column(Text, nullable=True)  # Deployment logs
    
    # Tenant information
    tenant_id = Column(UUID, ForeignKey("tenants.tenant_id"))
    tenant = relationship("Tenant", backref="deployments")
    
    # User information
    created_by = Column(UUID, ForeignKey("users.user_id"))
    updated_by = Column(UUID, ForeignKey("users.user_id"), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    started_at = Column(DateTime, nullable=True)  # When the deployment started
    completed_at = Column(DateTime, nullable=True)  # When the deployment completed
    
    # Deployment container information
    container_id = Column(String, nullable=True)  # ID of the container that processed this deployment
    container_logs = Column(Text, nullable=True)  # Logs from the container
    
    # Deployment options
    is_dry_run = Column(Boolean, default=False)  # Whether this is a dry run
    auto_approve = Column(Boolean, default=False)  # Whether to auto-approve changes
    
    # Error information
    error_message = Column(Text, nullable=True)  # Error message if deployment failed
    error_details = Column(JSON, nullable=True)  # Detailed error information


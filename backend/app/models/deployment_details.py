from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from datetime import datetime

from app.models.base_models import Base, generate_uuid

class DeploymentDetails(Base):
    __tablename__ = "deployment_details"
    
    id = Column(Integer, primary_key=True, index=True)
    detail_id = Column(UUID(as_uuid=False), unique=True, index=True, default=generate_uuid)
    
    # Deployment status and metadata
    status = Column(String)  # pending, in_progress, completed, failed
    provider = Column(String)  # azure, aws, gcp
    deployment_type = Column(String)  # native, terraform
    template_source = Column(String)  # url, code
    template_url = Column(String, nullable=True)
    
    # Cloud-specific details
    cloud_deployment_id = Column(String, nullable=True)  # ID from the cloud provider
    cloud_region = Column(String, nullable=True)
    resource_group = Column(String, nullable=True)  # Resource group name
    cloud_resources = Column(JSON, nullable=True)  # List of resources created
    
    # Deployment logs and outputs
    logs = Column(JSON, nullable=True)  # Deployment logs
    outputs = Column(JSON, nullable=True)  # Deployment outputs
    error_details = Column(JSON, nullable=True)  # Error details if failed
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    deployment_id = Column(Integer, ForeignKey("deployments.id"))
    deployment = relationship("Deployment", back_populates="details")

# Add relationship to Deployment model
from app.models.deployment import Deployment
Deployment.details = relationship("DeploymentDetails", back_populates="deployment", uselist=False)

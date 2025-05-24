from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import UUID

from app.models.base_models import Base

class DeploymentDetails(Base):
    """
    Deployment details model for storing cloud deployment information
    """
    __tablename__ = "deployment_details"

    id = Column(Integer, primary_key=True, index=True)
    deployment_id = Column(UUID(as_uuid=False), ForeignKey("deployments.deployment_id"), nullable=False)
    provider = Column(String, nullable=False)  # azure, aws, gcp
    status = Column(String, nullable=False)  # running, failed, pending, etc.
    resource_id = Column(String, nullable=True)  # Cloud provider resource ID
    resource_name = Column(String, nullable=True)  # Cloud provider resource name
    resource_type = Column(String, nullable=True)  # VM, Storage, etc.
    region = Column(String, nullable=True)  # Region/location
    subscription_id = Column(String, nullable=True)  # Azure subscription ID, AWS account ID, GCP project ID
    resource_group = Column(String, nullable=True)  # Azure resource group, AWS VPC, GCP folder
    tags = Column(JSON, nullable=True)  # Resource tags
    additional_metadata = Column(JSON, nullable=True)  # Additional metadata (renamed from metadata)
    logs = Column(Text, nullable=True)  # Deployment logs
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationship to the deployment
    deployment = relationship("Deployment", back_populates="deployment_details")

    def __repr__(self):
        return f"<DeploymentDetails(id={self.id}, deployment_id={self.deployment_id}, provider={self.provider}, status={self.status})>"

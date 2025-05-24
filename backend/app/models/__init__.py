# Import all models here for easy access
from app.models.base_models import Base
from app.models.user import User, Role, Permission, Tenant
from app.models.deployment import CloudAccount, Environment, Template, TemplateVersion, Deployment, DeploymentHistory
from app.models.deployment_details import DeploymentDetails
from app.models.template_foundry import TemplateFoundry
from app.models.template_foundry_versions import TemplateFoundryVersion
from app.models.integration import IntegrationConfig
from app.models.nexus_ai import NexusAIConfig, NexusAILog

# Import relationship for setting up relationships
from sqlalchemy.orm import relationship

# Set up relationships to avoid circular imports
Deployment.deployment_details = relationship("DeploymentDetails", back_populates="deployment", cascade="all, delete-orphan")
DeploymentDetails.deployment = relationship("Deployment", back_populates="deployment_details")

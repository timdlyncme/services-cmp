# Import all models to ensure they are registered with SQLAlchemy
from app.models.base_models import Base
from app.models.user import User, Role, Permission, Tenant
from app.models.user_tenant_assignment import UserTenantAssignment
from app.models.deployment import CloudAccount, Environment, Template, TemplateVersion, Deployment, DeploymentHistory
from app.models.template_foundry import TemplateFoundry
from app.models.template_foundry_versions import TemplateFoundryVersion
from app.models.integration import IntegrationConfig
from app.models.nexus_ai import NexusAIConfig, NexusAILog
from app.models.cloud_settings import CloudSettings
from app.models.dashboard import Dashboard, DashboardWidget, UserWidget

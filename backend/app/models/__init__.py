# Import all models to ensure they are registered with SQLAlchemy
from app.models.base_models import Base
from app.models.user import User, Role, Permission, Tenant
from app.models.deployment import Deployment, CloudAccount, Environment, Template


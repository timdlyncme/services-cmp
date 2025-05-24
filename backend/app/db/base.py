# Import all the models, so that Base has them before being
# imported by Alembic
from app.db.base_class import Base  # noqa
from app.models.user import User  # noqa
from app.models.tenant import Tenant  # noqa
from app.models.role import Role  # noqa
from app.models.permission import Permission  # noqa
from app.models.role_permission import RolePermission  # noqa
from app.models.user_role import UserRole  # noqa
from app.models.cloud_account import CloudAccount  # noqa
from app.models.cloud_setting import CloudSetting  # noqa
from app.models.template import Template  # noqa
from app.models.deployment import Deployment  # noqa
from app.models.environment import Environment  # noqa
from app.models.deployment_details import DeploymentDetails  # noqa

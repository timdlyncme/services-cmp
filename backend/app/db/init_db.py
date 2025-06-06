"""
Database initialization script.

This script creates initial data for the application, including:
- Roles and permissions
- Default tenants
- Admin user
- Dashboard widgets
- AI service configurations

This is the consolidated initialization for fresh database setup.
All migration logic has been integrated here.
"""

import logging
import uuid
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.core.config import settings
from app.core.security import get_password_hash

# Import all models to ensure they're registered with Base
from app.models.user import User, Role, Permission, Tenant
from app.models.deployment import CloudAccount, Environment, Template, Deployment, TemplateVersion
from app.models.deployment_details import DeploymentDetails
from app.models.cloud_settings import CloudSettings
from app.models.integration import IntegrationConfig
from app.models.template_foundry import TemplateFoundry
from app.models.template_foundry_versions import TemplateFoundryVersion
from app.models.nexus_ai import NexusAIConfig, NexusAILog
from app.models.ai_assistant import AIAssistantConfig, AIAssistantLog
from app.models.dashboard import Dashboard, DashboardWidget, UserWidget

logger = logging.getLogger(__name__)

# Helper function to generate UUIDs
def generate_uuid():
    return str(uuid.uuid4())


# Permissions
PERMISSIONS = [
    # User management (tenant-scoped)
    {"name": "view:users", "description": "View users", "scope": "tenant"},
    {"name": "create:users", "description": "Create users", "scope": "tenant"},
    {"name": "update:users", "description": "Update users", "scope": "tenant"},
    {"name": "delete:users", "description": "Delete users", "scope": "tenant"},
    
    # Tenant management (global for MSP, restricted for others)
    {"name": "view:all-tenants", "description": "View all tenants", "scope": "global"},
    {"name": "create:tenants", "description": "Create tenants", "scope": "global"},
    {"name": "update:tenants", "description": "Update tenants", "scope": "global"},
    {"name": "delete:tenants", "description": "Delete tenants", "scope": "global"},
    
    # MSP user management (global)
    {"name": "view:msp-users", "description": "View MSP users", "scope": "global"},
    {"name": "create:msp-users", "description": "Create MSP users", "scope": "global"},
    {"name": "update:msp-users", "description": "Update MSP users", "scope": "global"},
    {"name": "delete:msp-users", "description": "Delete MSP users", "scope": "global"},
    
    # Permissions management (global)
    {"name": "view:permissions", "description": "View permissions", "scope": "global"},
    {"name": "create:permissions", "description": "Create permissions", "scope": "global"},
    {"name": "update:permissions", "description": "Update permissions", "scope": "global"},
    {"name": "delete:permissions", "description": "Delete permissions", "scope": "global"},
    
    # Cloud accounts (tenant-scoped)
    {"name": "view:cloud-accounts", "description": "View cloud accounts", "scope": "tenant"},
    {"name": "create:cloud-accounts", "description": "Create cloud accounts", "scope": "tenant"},
    {"name": "update:cloud-accounts", "description": "Update cloud accounts", "scope": "tenant"},
    {"name": "delete:cloud-accounts", "description": "Delete cloud accounts", "scope": "tenant"},
    
    # Environments (tenant-scoped)
    {"name": "view:environments", "description": "View environments", "scope": "tenant"},
    {"name": "create:environments", "description": "Create environments", "scope": "tenant"},
    {"name": "update:environments", "description": "Update environments", "scope": "tenant"},
    {"name": "delete:environments", "description": "Delete environments", "scope": "tenant"},
    
    # Templates (tenant-scoped)
    {"name": "view:templates", "description": "View templates", "scope": "tenant"},
    {"name": "create:templates", "description": "Create templates", "scope": "tenant"},
    {"name": "update:templates", "description": "Update templates", "scope": "tenant"},
    {"name": "delete:templates", "description": "Delete templates", "scope": "tenant"},
    
    # Template foundry (tenant-scoped)
    {"name": "view:template-foundry", "description": "View template foundry", "scope": "tenant"},
    {"name": "create:template-foundry", "description": "Create templates in foundry", "scope": "tenant"},
    {"name": "update:template-foundry", "description": "Update templates in foundry", "scope": "tenant"},
    {"name": "delete:template-foundry", "description": "Delete templates from foundry", "scope": "tenant"},
    
    # Deployments (tenant-scoped)
    {"name": "view:deployments", "description": "View deployments", "scope": "tenant"},
    {"name": "create:deployments", "description": "Create deployments", "scope": "tenant"},
    {"name": "update:deployments", "description": "Update deployments", "scope": "tenant"},
    {"name": "delete:deployments", "description": "Delete deployments", "scope": "tenant"},
    {"name": "manage:deployments", "description": "Manage deployment engine credentials and resources", "scope": "tenant"},
    
    # Settings (tenant-scoped)
    {"name": "view:settings", "description": "View settings", "scope": "tenant"},
    {"name": "update:settings", "description": "Update settings", "scope": "tenant"},
    
    # AI Services (tenant-scoped)
    {"name": "use:nexus_ai", "description": "Use NexusAI", "scope": "tenant"},
    {"name": "manage:nexus_ai", "description": "Manage NexusAI settings", "scope": "tenant"},
    {"name": "use:ai_assistant", "description": "Use AI Assistant", "scope": "tenant"},
    
    # Global platform management (global)
    {"name": "manage:global-settings", "description": "Manage global platform settings", "scope": "global"},
    {"name": "view:platform-analytics", "description": "View platform-wide analytics", "scope": "global"},
]

# Roles with their permissions (updated for new permission model)
ROLES = [
    {
        "name": "user",
        "description": "Regular user with limited permissions within assigned tenants",
        "permissions": [
            "view:cloud-accounts", "view:environments", "view:templates", "view:deployments",
            "create:deployments", "update:deployments", "delete:deployments",
            "use:nexus_ai", "use:ai_assistant"
        ]
    },
    {
        "name": "admin", 
        "description": "Administrator with full permissions within assigned tenants",
        "permissions": [
            "view:users", "create:users", "update:users", "delete:users",
            "view:cloud-accounts", "create:cloud-accounts", "update:cloud-accounts", "delete:cloud-accounts",
            "view:environments", "create:environments", "update:environments", "delete:environments",
            "view:templates", "create:templates", "update:templates", "delete:templates",
            "view:template-foundry", "create:template-foundry", "update:template-foundry", "delete:template-foundry",
            "view:deployments", "create:deployments", "update:deployments", "delete:deployments", "manage:deployments",
            "view:settings", "update:settings", "use:ai_assistant", "use:nexus_ai", "manage:nexus_ai"
        ]
    },
    {
        "name": "msp",
        "description": "Managed Service Provider with global access across all tenants",
        "permissions": [p["name"] for p in PERMISSIONS]  # MSP gets all permissions
    }
]


# Default tenants with UUID-based tenant_ids
TENANTS = [
    {
        "name": "Solutions Development",
        "description": "Solutions Development tenant",
        "tenant_id": generate_uuid()
    },
    {
        "name": "Platforms",
        "description": "Platforms tenant",
        "tenant_id": generate_uuid()
    },
    {
        "name": "App Dev",
        "description": "App Dev tenant",
        "tenant_id": generate_uuid()
    }
]

# Default users with UUID-based user_ids
USERS = [
    {
        "email": "admin@example.com",
        "username": "admin",
        "full_name": "Admin User",
        "password": "admin123",  # This would be hashed in production
        "role": "admin",
        "tenant": 0,  # Index in TENANTS list
        "user_id": generate_uuid(),
        "is_msp_user": False
    },
    {
        "email": "user@example.com",
        "username": "user",
        "full_name": "Regular User",
        "password": "user123",  # This would be hashed in production
        "role": "user",
        "tenant": 0,  # Index in TENANTS list
        "user_id": generate_uuid(),
        "is_msp_user": False
    },
    {
        "email": "msp@example.com",
        "username": "msp",
        "full_name": "MSP User",
        "password": "msp123",  # This would be hashed in production
        "role": "msp",
        "tenant": 0,  # Index in TENANTS list (primary tenant)
        "user_id": generate_uuid(),
        "is_msp_user": True
    },
    {
        "email": "dev@example.com",
        "username": "dev",
        "full_name": "Developer User",
        "password": "dev123",  # This would be hashed in production
        "role": "user",
        "tenant": 1,  # Index in TENANTS list
        "user_id": generate_uuid(),
        "is_msp_user": False
    },
    {
        "email": "ops@example.com",
        "username": "ops",
        "full_name": "Operations User",
        "password": "ops123",  # This would be hashed in production
        "role": "user",
        "tenant": 2,  # Index in TENANTS list
        "user_id": generate_uuid(),
        "is_msp_user": False
    }
]


# Default dashboard widgets
DEFAULT_DASHBOARD_WIDGETS = [
    {
        "name": "Total Deployments",
        "description": "Shows the total number of deployments across all environments",
        "widget_type": "platform_stats",
        "category": "statistics",
        "data_source": "/api/deployments/stats",
        "default_config": {
            "chart_type": "number",
            "icon": "database",
            "color": "blue"
        },
        "min_width": 2,
        "min_height": 1,
        "max_width": 3,
        "max_height": 1
    },
    {
        "name": "Running Deployments",
        "description": "Shows the number of currently running deployments",
        "widget_type": "platform_stats",
        "category": "statistics",
        "data_source": "/api/deployments/stats",
        "default_config": {
            "chart_type": "number",
            "icon": "check-circle",
            "color": "green",
            "filter": "status:running"
        },
        "min_width": 2,
        "min_height": 1,
        "max_width": 3,
        "max_height": 1
    },
    {
        "name": "Failed Deployments",
        "description": "Shows the number of failed deployments",
        "widget_type": "platform_stats",
        "category": "statistics",
        "data_source": "/api/deployments/stats",
        "default_config": {
            "chart_type": "number",
            "icon": "alert-circle",
            "color": "red",
            "filter": "status:failed"
        },
        "min_width": 2,
        "min_height": 1,
        "max_width": 3,
        "max_height": 1
    },
    {
        "name": "Cloud Accounts",
        "description": "Shows the total number of connected cloud accounts",
        "widget_type": "platform_stats",
        "category": "statistics",
        "data_source": "/api/cloud-accounts/stats",
        "default_config": {
            "chart_type": "number",
            "icon": "cloud-cog",
            "color": "purple"
        },
        "min_width": 2,
        "min_height": 1,
        "max_width": 3,
        "max_height": 1
    },
    {
        "name": "Templates",
        "description": "Shows the total number of available templates",
        "widget_type": "platform_stats",
        "category": "statistics",
        "data_source": "/api/templates/stats",
        "default_config": {
            "chart_type": "number",
            "icon": "file-text",
            "color": "orange"
        },
        "min_width": 2,
        "min_height": 1,
        "max_width": 3,
        "max_height": 1
    },
    {
        "name": "Deployments by Provider",
        "description": "Pie chart showing deployment distribution across cloud providers",
        "widget_type": "visual",
        "category": "charts",
        "data_source": "/api/deployments/by-provider",
        "default_config": {
            "chart_type": "pie",
            "title": "Deployments by Provider"
        },
        "min_width": 3,
        "min_height": 3,
        "max_width": 4,
        "max_height": 4
    },
    {
        "name": "Deployment Status Overview",
        "description": "Bar chart showing deployment status distribution",
        "widget_type": "visual",
        "category": "charts",
        "data_source": "/api/deployments/status-overview",
        "default_config": {
            "chart_type": "bar",
            "title": "Deployment Status Overview"
        },
        "min_width": 3,
        "min_height": 3,
        "max_width": 4,
        "max_height": 4
    },
    {
        "name": "Deployment Timeline",
        "description": "Line chart showing deployment activity over time",
        "widget_type": "visual",
        "category": "charts",
        "data_source": "/api/deployments/timeline",
        "default_config": {
            "chart_type": "line",
            "title": "Deployment Timeline",
            "time_range": "30d"
        },
        "min_width": 4,
        "min_height": 3,
        "max_width": 6,
        "max_height": 4
    },
    {
        "name": "Recent Deployments",
        "description": "List of the most recent deployments",
        "widget_type": "status",
        "category": "monitoring",
        "data_source": "/api/deployments/recent",
        "default_config": {
            "list_type": "deployments",
            "limit": 5,
            "show_status": True
        },
        "min_width": 3,
        "min_height": 3,
        "max_width": 4,
        "max_height": 6
    },
    {
        "name": "Cloud Account Status",
        "description": "Status overview of connected cloud accounts",
        "widget_type": "status",
        "category": "monitoring",
        "data_source": "/api/cloud-accounts/status",
        "default_config": {
            "list_type": "cloud_accounts",
            "show_health": True
        },
        "min_width": 3,
        "min_height": 3,
        "max_width": 4,
        "max_height": 6
    },
    {
        "name": "Welcome Message",
        "description": "Customizable welcome message widget",
        "widget_type": "text",
        "category": "information",
        "data_source": "static",
        "default_config": {
            "text_type": "welcome",
            "title": "Welcome to your Dashboard",
            "content": "Manage your cloud infrastructure deployments from this centralized dashboard."
        },
        "min_width": 3,
        "min_height": 2,
        "max_width": 6,
        "max_height": 3
    },
    {
        "name": "Quick Actions",
        "description": "Quick action buttons for common tasks",
        "widget_type": "text",
        "category": "information",
        "data_source": "static",
        "default_config": {
            "text_type": "actions",
            "actions": [
                {"label": "New Deployment", "url": "/deployments"},
                {"label": "Add Cloud Account", "url": "/cloud-accounts"},
                {"label": "Browse Templates", "url": "/catalog"}
            ]
        },
        "min_width": 3,
        "min_height": 2,
        "max_width": 3,
        "max_height": 2
    },
    {
        "name": "Getting Started",
        "description": "Checklist to help first-time users get started with the platform",
        "widget_type": "getting_started",
        "category": "onboarding",
        "data_source": "/api/getting-started/status",
        "default_config": {
            "show_progress": True,
            "auto_hide_completed": False
        },
        "min_width": 3,
        "min_height": 6,
        "max_width": 4,
        "max_height": 6
    }
]


def init_db(db: Session) -> None:
    """Initialize the database with default data."""
    logger.info("Starting database initialization...")
    
    # Create permissions
    logger.info("Creating permissions...")
    permissions = {}
    for permission_data in PERMISSIONS:
        permission = db.query(Permission).filter_by(name=permission_data["name"]).first()
        if not permission:
            permission = Permission(**permission_data)
            db.add(permission)
            db.flush()
        permissions[permission.name] = permission
    
    # Create roles
    logger.info("Creating roles...")
    roles = {}
    for role_data in ROLES:
        role = db.query(Role).filter_by(name=role_data["name"]).first()
        if not role:
            role = Role(
                name=role_data["name"],
                description=role_data["description"]
            )
            # Add permissions to role
            for permission_name in role_data["permissions"]:
                if permission_name in permissions:
                    role.permissions.append(permissions[permission_name])
            db.add(role)
            db.flush()
        roles[role.name] = role
    
    # Create tenants
    logger.info("Creating tenants...")
    tenants = {}
    for i, tenant_data in enumerate(TENANTS):
        tenant = db.query(Tenant).filter_by(name=tenant_data["name"]).first()
        if not tenant:
            tenant = Tenant(**tenant_data)
            db.add(tenant)
            db.flush()
        tenants[i] = tenant  # Store by index for user reference
        tenants[tenant.tenant_id] = tenant  # Also store by tenant_id for later reference
    
    # Create users
    logger.info("Creating users...")
    for user_data in USERS:
        user = db.query(User).filter_by(email=user_data["email"]).first()
        if not user:
            # Get role and tenant
            role = roles.get(user_data["role"])
            tenant_index = user_data["tenant"]
            tenant = tenants.get(tenant_index)
            
            if role and tenant:
                user = User(
                    email=user_data["email"],
                    username=user_data["username"],
                    full_name=user_data["full_name"],
                    hashed_password=get_password_hash(user_data["password"]),
                    role_id=role.id,
                    tenant_id=tenant.tenant_id,  # Use tenant_id (UUID) instead of id (Integer)
                    user_id=user_data.get("user_id"),
                    is_msp_user=user_data.get("is_msp_user")
                )
                db.add(user)
                db.flush()  # Flush to get the user ID
                
                # Create user-tenant assignment for the new multi-tenant system
                from app.models.user_tenant_assignment import UserTenantAssignment
                
                # Create primary tenant assignment
                primary_assignment = UserTenantAssignment(
                    user_id=user.user_id,
                    tenant_id=tenant.tenant_id,
                    role_id=role.id,
                    is_primary=True,
                    is_active=True
                )
                db.add(primary_assignment)
                
                # For MSP users, create assignments to all tenants
                if user_data.get("is_msp_user", False):
                    for tenant_id, tenant_obj in tenants.items():
                        if isinstance(tenant_id, str) and tenant_id != tenant.tenant_id:  # Skip primary tenant
                            msp_assignment = UserTenantAssignment(
                                user_id=user.user_id,
                                tenant_id=tenant_id,
                                role_id=role.id,
                                is_primary=False,
                                is_active=True
                            )
                            db.add(msp_assignment)
    
    # Create default AI configurations
    logger.info("Creating default AI configurations...")
    
    # Create default NexusAI configuration
    nexus_config = db.query(NexusAIConfig).first()
    if not nexus_config:
        nexus_config = NexusAIConfig(
            api_key=None,
            endpoint=None,
            deployment_name=None,
            api_version="2023-05-15",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            last_status="disconnected",
            last_checked=None,
            last_error=None
        )
        db.add(nexus_config)
    
    # Create default AI Assistant configuration
    ai_assistant_config = db.query(AIAssistantConfig).first()
    if not ai_assistant_config:
        ai_assistant_config = AIAssistantConfig(
            api_key=None,
            endpoint=None,
            deployment_name=None,
            model="gpt-4",
            api_version="2023-05-15",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
            last_status="disconnected",
            last_checked=None,
            last_error=None
        )
        db.add(ai_assistant_config)
    
    # Create default dashboard widgets
    logger.info("Creating default dashboard widgets...")
    for widget_data in DEFAULT_DASHBOARD_WIDGETS:
        # Check if widget already exists
        existing_widget = db.query(DashboardWidget).filter(
            DashboardWidget.name == widget_data["name"]
        ).first()
        
        if not existing_widget:
            widget = DashboardWidget(**widget_data)
            db.add(widget)
    
    # Commit all changes
    db.commit()
    logger.info("Database initialization completed successfully")

def create_sample_data(db: Session) -> None:
    """Create comprehensive sample data for the application."""
    # Get all tenants
    tenants = db.query(Tenant).all()
    if not tenants:
        logger.error("No tenants found")
        return
    
    # Get all users for later use
    users_by_tenant = {}
    for tenant in tenants:
        tenant_users = db.query(User).filter(User.tenant_id == tenant.tenant_id).all()
        if tenant_users:
            users_by_tenant[tenant.tenant_id] = tenant_users
    
    # Create sample cloud accounts for each tenant
    cloud_accounts = []
    for tenant in tenants:
        for i, provider in enumerate(["azure", "aws", "gcp"]):
            account = CloudAccount(
                account_id=generate_uuid(),
                name=f"{provider.capitalize()} Account for {tenant.name}",
                provider=provider,
                status="connected",
                description=f"Sample {provider.upper()} account for {tenant.name}",
                tenant_id=tenant.tenant_id  # Use tenant_id (UUID) instead of id (Integer)
            )
            db.add(account)
            db.flush()
            cloud_accounts.append(account)
            
            # Create additional accounts for more variety
            if i == 0:  # For Azure, create multiple accounts
                for j in range(2):
                    extra_account = CloudAccount(
                        account_id=generate_uuid(),
                        name=f"{provider.capitalize()} Extra {j+1} for {tenant.name}",
                        provider=provider,
                        status=["connected", "warning", "error"][j % 3],
                        description=f"Additional {provider.upper()} account {j+1} for {tenant.name}",
                        tenant_id=tenant.tenant_id  # Use tenant_id (UUID) instead of id (Integer)
                    )
                    db.add(extra_account)
                    db.flush()
                    cloud_accounts.append(extra_account)
    
    # Create sample environments for each tenant
    environments = []
    for tenant in tenants:
        # Create multiple environments per tenant
        for i, env_type in enumerate(["Development", "Testing", "Staging", "Production"]):
            if i > 0 and tenant.name == "Cloud Ops":  # Fewer environments for Cloud Ops
                continue
                
            environment = Environment(
                environment_id=generate_uuid(),
                name=f"{env_type} Environment",
                description=f"{env_type} environment for {tenant.name}",
                tenant_id=tenant.tenant_id,  # Use tenant_id (UUID) instead of id (Integer)
                update_strategy="rolling" if env_type == "Production" else "blue-green",
                scaling_policies={
                    "min_instances": 1,
                    "max_instances": 10 if env_type == "Production" else 3,
                    "cpu_threshold": 70
                },
                environment_variables={
                    "ENV_TYPE": env_type.upper(),
                    "DEBUG": "false" if env_type == "Production" else "true",
                    "LOG_LEVEL": "INFO" if env_type == "Production" else "DEBUG"
                }
            )
            db.add(environment)
            db.flush()
            environments.append(environment)
            
            # Associate environment with cloud accounts
            tenant_cloud_accounts = [ca for ca in cloud_accounts if ca.tenant_id == tenant.id]
            for j, cloud_account in enumerate(tenant_cloud_accounts):
                if j < 2:  # Associate with up to 2 cloud accounts
                    environment.cloud_accounts.append(cloud_account)
            
            db.flush()
    
    # Create sample templates for each tenant
    templates = []
    
    # Sample template code snippets for different providers
    azure_templates = [
        {
            "name": "Azure Web App",
            "description": "Deploy a web application to Azure App Service",
            "category": "Web, App Service",
            "code": """
provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "example" {
  name     = "example-resources"
  location = "East US"
}

resource "azurerm_app_service_plan" "example" {
  name                = "example-appserviceplan"
  location            = azurerm_resource_group.example.location
  resource_group_name = azurerm_resource_group.example.name
  sku {
    tier = "Standard"
    size = "S1"
  }
}

resource "azurerm_app_service" "example" {
  name                = "example-app-service"
  location            = azurerm_resource_group.example.location
  resource_group_name = azurerm_resource_group.example.name
  app_service_plan_id = azurerm_app_service_plan.example.id
}
"""
        },
        {
            "name": "Azure Storage Account",
            "description": "Create an Azure Storage Account with blob container",
            "category": "Storage",
            "code": """
provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "example" {
  name     = "example-resources"
  location = "East US"
}

resource "azurerm_storage_account" "example" {
  name                     = "examplestorageacct"
  resource_group_name      = azurerm_resource_group.example.name
  location                 = azurerm_resource_group.example.location
  account_tier             = "Standard"
  account_replication_type = "LRS"
}

resource "azurerm_storage_container" "example" {
  name                  = "content"
  storage_account_name  = azurerm_storage_account.example.name
  container_access_type = "private"
}
"""
        },
        {
            "name": "Azure Virtual Network",
            "description": "Deploy a virtual network with subnets",
            "category": "Networking",
            "code": """
provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "example" {
  name     = "example-resources"
  location = "East US"
}

resource "azurerm_virtual_network" "example" {
  name                = "example-network"
  address_space       = ["10.0.0.0/16"]
  location            = azurerm_resource_group.example.location
  resource_group_name = azurerm_resource_group.example.name
}

resource "azurerm_subnet" "example" {
  name                 = "internal"
  resource_group_name  = azurerm_resource_group.example.name
  virtual_network_name = azurerm_virtual_network.example.name
  address_prefixes     = ["10.0.2.0/24"]
}
"""
        }
    ]
    
    aws_templates = [
        {
            "name": "AWS S3 Bucket",
            "description": "Create an S3 bucket with versioning enabled",
            "category": "Storage",
            "code": """
provider "aws" {
  region = "us-west-2"
}

resource "aws_s3_bucket" "example" {
  bucket = "my-example-bucket"
  acl    = "private"

  versioning {
    enabled = true
  }

  tags = {
    Name        = "My Example Bucket"
    Environment = "Dev"
  }
}
"""
        },
        {
            "name": "AWS EC2 Instance",
            "description": "Deploy an EC2 instance with security group",
            "category": "Compute",
            "code": """
provider "aws" {
  region = "us-west-2"
}

resource "aws_vpc" "example" {
  cidr_block = "10.0.0.0/16"
  
  tags = {
    Name = "example-vpc"
  }
}

resource "aws_subnet" "example" {
  vpc_id     = aws_vpc.example.id
  cidr_block = "10.0.1.0/24"
  
  tags = {
    Name = "example-subnet"
  }
}

resource "aws_security_group" "example" {
  name        = "example-security-group"
  description = "Allow SSH and HTTP"
  vpc_id      = aws_vpc.example.id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_instance" "example" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t2.micro"
  subnet_id     = aws_subnet.example.id
  
  vpc_security_group_ids = [aws_security_group.example.id]
  
  tags = {
    Name = "example-instance"
  }
}
"""
        },
        {
            "name": "AWS EKS Cluster",
            "description": "Deploy an Amazon EKS cluster",
            "category": "Containers, Kubernetes",
            "code": """
provider "aws" {
  region = "us-west-2"
}

resource "aws_vpc" "example" {
  cidr_block = "10.0.0.0/16"
  
  tags = {
    Name = "eks-vpc"
  }
}

resource "aws_subnet" "example1" {
  vpc_id     = aws_vpc.example.id
  cidr_block = "10.0.1.0/24"
  availability_zone = "us-west-2a"
  
  tags = {
    Name = "eks-subnet-1"
  }
}

resource "aws_subnet" "example2" {
  vpc_id     = aws_vpc.example.id
  cidr_block = "10.0.2.0/24"
  availability_zone = "us-west-2b"
  
  tags = {
    Name = "eks-subnet-2"
  }
}

resource "aws_iam_role" "example" {
  name = "eks-cluster-role"

  assume_role_policy = <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "eks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
POLICY
}

resource "aws_iam_role_policy_attachment" "example-AmazonEKSClusterPolicy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.example.name
}

resource "aws_eks_cluster" "example" {
  name     = "example-eks-cluster"
  role_arn = aws_iam_role.example.arn

  vpc_config {
    subnet_ids = [aws_subnet.example1.id, aws_subnet.example2.id]
  }
}
"""
        }
    ]
    
    gcp_templates = [
        {
            "name": "GCP Cloud Storage",
            "description": "Create a Google Cloud Storage bucket",
            "category": "Storage",
            "code": """
provider "google" {
  project = "my-project-id"
  region  = "us-central1"
}

resource "google_storage_bucket" "example" {
  name          = "my-example-bucket"
  location      = "US"
  force_destroy = true

  versioning {
    enabled = true
  }
}
"""
        },
        {
            "name": "GCP Compute Instance",
            "description": "Deploy a Google Compute Engine instance",
            "category": "Compute",
            "code": """
provider "google" {
  project = "my-project-id"
  region  = "us-central1"
  zone    = "us-central1-a"
}

resource "google_compute_network" "vpc_network" {
  name = "example-network"
}

resource "google_compute_instance" "example" {
  name         = "example-instance"
  machine_type = "e2-medium"
  
  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-10"
    }
  }

  network_interface {
    network = google_compute_network.vpc_network.name
    access_config {
      // Ephemeral IP
    }
  }
}
"""
        },
        {
            "name": "GCP GKE Cluster",
            "description": "Deploy a Google Kubernetes Engine cluster",
            "category": "Containers, Kubernetes",
            "code": """
provider "google" {
  project = "my-project-id"
  region  = "us-central1"
}

resource "google_vpc_network" "vpc_network" {
  name = "example-network"
}

resource "google_compute_instance" "example" {
  name         = "example-instance"
  machine_type = "e2-medium"
  
  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-10"
    }
  }

  network_interface {
    network = google_vpc_network.vpc_network.name
    access_config {
      // Ephemeral IP
    }
  }
}
"""
        }
    ]
    
    # Assign different templates to different tenants
    for i, tenant in enumerate(tenants):
        # Determine which templates to use for this tenant
        tenant_templates = []
        
        # First tenant gets all Azure templates
        if i == 0:
            tenant_templates.extend([(t, "azure") for t in azure_templates])
            # Add one AWS template
            tenant_templates.append((aws_templates[0], "aws"))
        
        # Second tenant gets all AWS templates
        elif i == 1:
            tenant_templates.extend([(t, "aws") for t in aws_templates])
            # Add one GCP template
            tenant_templates.append((gcp_templates[0], "gcp"))
        
        # Third tenant gets all GCP templates
        elif i == 2:
            tenant_templates.extend([(t, "gcp") for t in gcp_templates])
            # Add one Azure template
            tenant_templates.append((azure_templates[0], "azure"))
        
        # Create templates for this tenant
        for j, (template_data, provider) in enumerate(tenant_templates):
            # Create template with unique name for this tenant
            template_name = f"{template_data['name']} - {tenant.name}"
            
            template = Template(
                template_id=generate_uuid(),
                name=template_name,
                description=f"{template_data['description']} for {tenant.name}",
                category=template_data["category"],
                provider=provider,
                is_public=False,
                tenant_id=tenant.tenant_id,
                code=template_data["code"],
                current_version="1.0.0",
                created_at=datetime.utcnow() - timedelta(days=30 - j),
                updated_at=datetime.utcnow() - timedelta(days=15 - j)
            )
            
            db.add(template)
            db.flush()
            templates.append(template)
            
            # Create initial version
            initial_version = TemplateVersion(
                template_id=template.id,
                version="1.0.0",
                code=template_data["code"],
                changes="Initial version",
                created_at=template.created_at,
                created_by_id=users_by_tenant[tenant.tenant_id][0].id if tenant.tenant_id in users_by_tenant else None
            )
            
            db.add(initial_version)
            
            # For some templates, add a second version
            if j % 2 == 0:
                # Create a second version with a small change
                updated_code = template_data["code"].replace("example", f"example-{tenant.name.lower()}")
                second_version = TemplateVersion(
                    template_id=template.id,
                    version="1.0.1",
                    code=updated_code,
                    changes="Updated resource names",
                    created_at=template.updated_at,
                    created_by_id=users_by_tenant[tenant.tenant_id][0].id if tenant.tenant_id in users_by_tenant else None
                )
                
                db.add(second_version)
                
                # Update template with new code and version
                template.code = updated_code
                template.current_version = "1.0.1"
            
            db.flush()
    
    # Create sample template foundry items
    from app.models.template_foundry import TemplateFoundry
    
    # Sample template code snippets
    code_snippets = {
        "terraform": """
provider "azurerm" {
  features {}
}

resource "azurerm_resource_group" "example" {
  name     = "example-resources"
  location = "East US"
}

resource "azurerm_virtual_network" "example" {
  name                = "example-network"
  address_space       = ["10.0.0.0/16"]
  location            = azurerm_resource_group.example.location
  resource_group_name = azurerm_resource_group.example.name
}
""",
        "arm": """
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "storageAccountName": {
      "type": "string",
      "metadata": {
        "description": "Storage Account Name"
      }
    }
  },
  "resources": [
    {
      "type": "Microsoft.Storage/storageAccounts",
      "apiVersion": "2021-04-01",
      "name": "[parameters('storageAccountName')]",
      "location": "[resourceGroup().location]",
      "sku": {
        "name": "Standard_LRS"
      },
      "kind": "StorageV2"
    }
  ]
}
""",
        "cloudformation": """
AWSTemplateFormatVersion: '2010-09-09'
Resources:
  MyS3Bucket:
    Type: 'AWS::S3::Bucket'
    Properties:
      AccessControl: Private
      BucketName: my-example-bucket
""",
        "kubernetes": """
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  labels:
    app: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:1.14.2
        ports:
        - containerPort: 80
""",
        "bicep": """
param location string = resourceGroup().location
param storageAccountName string

resource storageAccount 'Microsoft.Storage/storageAccounts@2021-04-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
}

output storageAccountId string = storageAccount.id
"""
    }
    
    foundry_templates = [
        {
            "name": "Virtual Network",
            "description": "Azure Virtual Network with subnets",
            "type": "terraform",
            "provider": "azure",
            "categories": ["Networking", "Infrastructure"],
            "is_published": True
        },
        {
            "name": "Storage Account",
            "description": "Azure Storage Account with blob containers",
            "type": "arm",
            "provider": "azure",
            "categories": ["Storage", "Infrastructure"],
            "is_published": True
        },
        {
            "name": "S3 Bucket",
            "description": "AWS S3 Bucket for object storage",
            "type": "cloudformation",
            "provider": "aws",
            "categories": ["Storage", "Infrastructure"],
            "is_published": True
        },
        {
            "name": "EKS Cluster",
            "description": "AWS Elastic Kubernetes Service",
            "type": "terraform",
            "provider": "aws",
            "categories": ["Containers", "Kubernetes"],
            "is_published": False
        },
        {
            "name": "GKE Cluster",
            "description": "Google Kubernetes Engine cluster",
            "type": "terraform",
            "provider": "gcp",
            "categories": ["Containers", "Kubernetes"],
            "is_published": True
        },
        {
            "name": "Azure Function App",
            "description": "Serverless function app with HTTP trigger",
            "type": "bicep",
            "provider": "azure",
            "categories": ["Serverless", "Functions"],
            "is_published": True
        },
        {
            "name": "Web App with Database",
            "description": "Web application with managed database",
            "type": "terraform",
            "provider": "azure",
            "categories": ["Web", "Database"],
            "is_published": True
        },
        {
            "name": "Kubernetes Deployment",
            "description": "Basic Kubernetes deployment manifest",
            "type": "kubernetes",
            "provider": "gcp",
            "categories": ["Containers", "Kubernetes"],
            "is_published": True
        },
        {
            "name": "Lambda Function",
            "description": "AWS Lambda function with API Gateway",
            "type": "cloudformation",
            "provider": "aws",
            "categories": ["Serverless", "Functions"],
            "is_published": True
        },
        {
            "name": "Container Registry",
            "description": "Private container registry for Docker images",
            "type": "terraform",
            "provider": "azure",
            "categories": ["Containers", "DevOps"],
            "is_published": False
        }
    ]
    
    # Create template foundry items for each tenant
    for tenant in tenants:
        tenant_users = users_by_tenant.get(tenant.tenant_id, [])
        if not tenant_users:
            continue
            
        for i, template_data in enumerate(foundry_templates):
            template_type = template_data["type"]
            user = tenant_users[i % len(tenant_users)]
            
            # Create the template with a creation date in the past
            created_at = datetime.utcnow() - timedelta(days=(10 - i % 10) * 10)
            updated_at = created_at + timedelta(days=5)
            
            foundry_item = TemplateFoundry(
                template_id=generate_uuid(),
                name=template_data["name"],
                description=f"{template_data['description']} for {tenant.name}",
                type=template_data["type"],
                provider=template_data["provider"],
                code=code_snippets.get(template_type, code_snippets["terraform"]),
                version="1.0.0",
                categories=template_data["categories"],
                is_published=template_data["is_published"],
                author=user.username,
                commit_id=generate_uuid(),
                tenant_id=tenant.tenant_id,  # Use tenant_id (UUID) instead of id (Integer)
                created_by_id=user.id,
                created_at=created_at,
                updated_at=updated_at
            )
            db.add(foundry_item)
    
    # Commit all changes
    db.commit()
    logger.info("Comprehensive sample data created successfully")

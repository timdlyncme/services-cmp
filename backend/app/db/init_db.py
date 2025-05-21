"""
Database initialization script.

This script creates initial data for the application, including:
- Roles and permissions
- Default tenants
- Admin user
"""

import logging
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User, Role, Permission, Tenant
from app.models.deployment import CloudAccount, Environment, Template, Deployment

logger = logging.getLogger(__name__)

# Permissions
PERMISSIONS = [
    # User management
    {"name": "view:users", "description": "View users"},
    {"name": "create:users", "description": "Create users"},
    {"name": "update:users", "description": "Update users"},
    {"name": "delete:users", "description": "Delete users"},
    
    # Tenant management
    {"name": "view:tenants", "description": "View tenants"},
    {"name": "create:tenants", "description": "Create tenants"},
    {"name": "update:tenants", "description": "Update tenants"},
    {"name": "delete:tenants", "description": "Delete tenants"},
    
    # Cloud accounts
    {"name": "view:cloud-accounts", "description": "View cloud accounts"},
    {"name": "create:cloud-accounts", "description": "Create cloud accounts"},
    {"name": "update:cloud-accounts", "description": "Update cloud accounts"},
    {"name": "delete:cloud-accounts", "description": "Delete cloud accounts"},
    
    # Environments
    {"name": "view:environments", "description": "View environments"},
    {"name": "create:environments", "description": "Create environments"},
    {"name": "update:environments", "description": "Update environments"},
    {"name": "delete:environments", "description": "Delete environments"},
    
    # Templates
    {"name": "view:templates", "description": "View templates"},
    {"name": "create:templates", "description": "Create templates"},
    {"name": "update:templates", "description": "Update templates"},
    {"name": "delete:templates", "description": "Delete templates"},
    
    # Template foundry
    {"name": "view:template-foundry", "description": "View template foundry"},
    {"name": "create:template-foundry", "description": "Create templates in foundry"},
    {"name": "update:template-foundry", "description": "Update templates in foundry"},
    {"name": "delete:template-foundry", "description": "Delete templates from foundry"},
    
    # Deployments
    {"name": "view:deployments", "description": "View deployments"},
    {"name": "create:deployments", "description": "Create deployments"},
    {"name": "update:deployments", "description": "Update deployments"},
    {"name": "delete:deployments", "description": "Delete deployments"},
    
    # NexusAI
    {"name": "use:nexus_ai", "description": "Use NexusAI"},
    {"name": "manage:nexus_ai", "description": "Manage NexusAI settings"},
]

# Roles with their permissions
ROLES = [
    {
        "name": "user",
        "description": "Regular user with limited permissions",
        "permissions": [
            "view:users", "view:tenants", 
            "view:cloud-accounts", "view:environments", "view:templates", "view:deployments",
            "create:deployments", "update:deployments", "delete:deployments",
            "use:nexus_ai"
        ]
    },
    {
        "name": "admin",
        "description": "Administrator with full permissions",
        "permissions": [p["name"] for p in PERMISSIONS]
    },
    {
        "name": "msp",
        "description": "Managed Service Provider with multi-tenant access",
        "permissions": [p["name"] for p in PERMISSIONS]
    }
]

# Default tenants
TENANTS = [
    {
        "name": "Default Tenant",
        "description": "Default tenant for the application",
        "tenant_id": "default"
    },
    {
        "name": "Demo Tenant",
        "description": "Demo tenant for showcasing features",
        "tenant_id": "demo"
    }
]

# Default users
USERS = [
    {
        "email": "admin@example.com",
        "username": "admin",
        "full_name": "Admin User",
        "password": "admin123",  # This would be hashed in production
        "role": "admin",
        "tenant": "default"
    },
    {
        "email": "user@example.com",
        "username": "user",
        "full_name": "Regular User",
        "password": "user123",  # This would be hashed in production
        "role": "user",
        "tenant": "default"
    },
    {
        "email": "msp@example.com",
        "username": "msp",
        "full_name": "MSP User",
        "password": "msp123",  # This would be hashed in production
        "role": "msp",
        "tenant": "default"
    }
]

def init_db(db: Session) -> None:
    """Initialize the database with default data."""
    # Create permissions
    permissions = {}
    for permission_data in PERMISSIONS:
        permission = db.query(Permission).filter_by(name=permission_data["name"]).first()
        if not permission:
            permission = Permission(**permission_data)
            db.add(permission)
            db.flush()
        permissions[permission.name] = permission
    
    # Create roles
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
    tenants = {}
    for tenant_data in TENANTS:
        tenant = db.query(Tenant).filter_by(tenant_id=tenant_data["tenant_id"]).first()
        if not tenant:
            tenant = Tenant(**tenant_data)
            db.add(tenant)
            db.flush()
        tenants[tenant.tenant_id] = tenant
    
    # Create users
    for user_data in USERS:
        user = db.query(User).filter_by(email=user_data["email"]).first()
        if not user:
            # Get role and tenant
            role = roles.get(user_data["role"])
            tenant = tenants.get(user_data["tenant"])
            
            if role and tenant:
                user = User(
                    email=user_data["email"],
                    username=user_data["username"],
                    full_name=user_data["full_name"],
                    hashed_password=get_password_hash(user_data["password"]),
                    role_id=role.id,
                    tenant_id=tenant.id
                )
                db.add(user)
    
    # Commit all changes
    db.commit()
    logger.info("Database initialized with default data")


def create_sample_data(db: Session) -> None:
    """Create sample data for the application."""
    # Get default tenant
    default_tenant = db.query(Tenant).filter_by(tenant_id="default").first()
    if not default_tenant:
        logger.error("Default tenant not found")
        return
    
    # Create sample cloud accounts
    cloud_accounts = []
    for provider in ["azure", "aws", "gcp"]:
        account = CloudAccount(
            account_id=f"{provider}-account",
            name=f"{provider.capitalize()} Account",
            provider=provider,
            status="connected",
            description=f"Sample {provider.upper()} account",
            tenant_id=default_tenant.id
        )
        db.add(account)
        db.flush()
        cloud_accounts.append(account)
    
    # Create sample environments
    environments = []
    for env_name in ["Development", "Staging", "Production"]:
        environment = Environment(
            environment_id=f"{env_name.lower()}-env",
            name=env_name,
            description=f"{env_name} environment",
            tenant_id=default_tenant.id,
            update_strategy="rolling",
            scaling_policies={"min": 1, "max": 5, "target_cpu": 70},
            environment_variables={"ENV": env_name.upper(), "DEBUG": env_name != "Production"}
        )
        db.add(environment)
        db.flush()
        environments.append(environment)
    
    # Associate cloud accounts with environments
    environments[0].cloud_accounts.append(cloud_accounts[0])  # Dev -> Azure
    environments[1].cloud_accounts.append(cloud_accounts[1])  # Staging -> AWS
    environments[2].cloud_accounts.extend([cloud_accounts[0], cloud_accounts[2]])  # Prod -> Azure, GCP
    
    # Create sample templates
    templates = []
    for i, (name, provider) in enumerate([
        ("Web App", "azure"),
        ("Database Cluster", "aws"),
        ("Kubernetes Cluster", "gcp")
    ]):
        template = Template(
            template_id=f"template-{i+1}",
            name=name,
            description=f"{name} template for {provider.upper()}",
            category="Infrastructure",
            provider=provider,
            is_public=True,
            tenant_id=default_tenant.id
        )
        db.add(template)
        db.flush()
        templates.append(template)
    
    # Commit all changes
    db.commit()
    logger.info("Sample data created successfully")


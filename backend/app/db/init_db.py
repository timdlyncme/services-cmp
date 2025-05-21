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
        "name": "Acme Corp",
        "description": "Main corporate tenant",
        "tenant_id": "tenant-1"
    },
    {
        "name": "Dev Team",
        "description": "Development team workspace",
        "tenant_id": "tenant-2"
    },
    {
        "name": "Cloud Ops",
        "description": "Cloud operations team",
        "tenant_id": "tenant-3"
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
        "tenant": "tenant-1",
        "user_id": "user-1"
    },
    {
        "email": "user@example.com",
        "username": "user",
        "full_name": "Regular User",
        "password": "user123",  # This would be hashed in production
        "role": "user",
        "tenant": "tenant-1",
        "user_id": "user-2"
    },
    {
        "email": "msp@example.com",
        "username": "msp",
        "full_name": "MSP User",
        "password": "msp123",  # This would be hashed in production
        "role": "msp",
        "tenant": "tenant-1",
        "user_id": "user-3"
    },
    {
        "email": "dev@example.com",
        "username": "dev",
        "full_name": "Developer User",
        "password": "dev123",  # This would be hashed in production
        "role": "user",
        "tenant": "tenant-2",
        "user_id": "user-4"
    },
    {
        "email": "ops@example.com",
        "username": "ops",
        "full_name": "Operations User",
        "password": "ops123",  # This would be hashed in production
        "role": "user",
        "tenant": "tenant-3",
        "user_id": "user-5"
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
                    tenant_id=tenant.id,
                    user_id=user_data.get("user_id")
                )
                db.add(user)
    
    # Commit all changes
    db.commit()
    logger.info("Database initialized with default data")


def create_sample_data(db: Session) -> None:
    """Create sample data for the application."""
    # Get all tenants
    tenants = db.query(Tenant).all()
    if not tenants:
        logger.error("No tenants found")
        return
    
    # Create sample cloud accounts for each tenant
    cloud_accounts = []
    for tenant in tenants:
        for provider in ["azure", "aws", "gcp"]:
            account = CloudAccount(
                account_id=f"{provider}-account-{tenant.tenant_id}",
                name=f"{provider.capitalize()} Account for {tenant.name}",
                provider=provider,
                status="connected",
                description=f"Sample {provider.upper()} account for {tenant.name}",
                tenant_id=tenant.id
            )
            db.add(account)
            db.flush()
            cloud_accounts.append(account)
    
    # Create sample environments for each tenant
    environments = []
    for tenant in tenants:
        for env_name in ["Development", "Staging", "Production"]:
            environment = Environment(
                environment_id=f"{env_name.lower()}-env-{tenant.tenant_id}",
                name=f"{env_name} for {tenant.name}",
                description=f"{env_name} environment for {tenant.name}",
                tenant_id=tenant.id,
                update_strategy="rolling",
                scaling_policies={"min": 1, "max": 5, "target_cpu": 70},
                environment_variables={"ENV": env_name.upper(), "DEBUG": env_name != "Production"}
            )
            db.add(environment)
            db.flush()
            environments.append(environment)
    
    # Associate cloud accounts with environments
    # Each tenant gets their own associations
    for i, tenant in enumerate(tenants):
        tenant_environments = [env for env in environments if env.tenant_id == tenant.id]
        tenant_accounts = [acc for acc in cloud_accounts if acc.tenant_id == tenant.id]
        
        if tenant_environments and tenant_accounts:
            # Development environment gets Azure
            tenant_environments[0].cloud_accounts.append(tenant_accounts[0])
            
            # Staging environment gets AWS
            if len(tenant_environments) > 1 and len(tenant_accounts) > 1:
                tenant_environments[1].cloud_accounts.append(tenant_accounts[1])
            
            # Production environment gets Azure and GCP
            if len(tenant_environments) > 2 and len(tenant_accounts) > 2:
                tenant_environments[2].cloud_accounts.append(tenant_accounts[0])
                tenant_environments[2].cloud_accounts.append(tenant_accounts[2])
    
    # Create sample templates for each tenant
    templates = []
    template_data = [
        {
            "name": "Web App",
            "description": "Basic web application template",
            "category": "Web",
            "provider": "azure"
        },
        {
            "name": "Database Cluster",
            "description": "Managed database cluster",
            "category": "Database",
            "provider": "aws"
        },
        {
            "name": "Kubernetes Cluster",
            "description": "Managed Kubernetes service",
            "category": "Containers",
            "provider": "gcp"
        },
        {
            "name": "Static Website",
            "description": "Static website hosting",
            "category": "Web",
            "provider": "aws"
        },
        {
            "name": "Virtual Machine Scale Set",
            "description": "Autoscaling VM group",
            "category": "Compute",
            "provider": "azure"
        }
    ]
    
    for tenant in tenants:
        for i, data in enumerate(template_data):
            template = Template(
                template_id=f"template-{i+1}-{tenant.tenant_id}",
                name=data["name"],
                description=f"{data['description']} for {tenant.name}",
                category=data["category"],
                provider=data["provider"],
                is_public=True,
                tenant_id=tenant.id
            )
            db.add(template)
            db.flush()
            templates.append(template)
    
    # Create sample deployments for each tenant
    for tenant in tenants:
        tenant_templates = [t for t in templates if t.tenant_id == tenant.id]
        tenant_environments = [e for e in environments if e.tenant_id == tenant.id]
        
        if not tenant_templates or not tenant_environments:
            continue
        
        # Create 2-3 deployments per tenant
        for i in range(min(3, len(tenant_templates))):
            template = tenant_templates[i]
            environment = tenant_environments[i % len(tenant_environments)]
            
            # Get a user from this tenant
            user = db.query(User).filter_by(tenant_id=tenant.id).first()
            if not user:
                continue
                
            deployment = Deployment(
                deployment_id=f"deployment-{i+1}-{tenant.tenant_id}",
                name=f"{template.name} Deployment {i+1}",
                status=["running", "pending", "stopped"][i % 3],
                template_id=template.id,
                environment_id=environment.id,
                tenant_id=tenant.id,
                created_by_id=user.id,
                parameters={
                    "region": "us-east-1" if template.provider == "aws" else "eastus" if template.provider == "azure" else "us-central1",
                    "size": "small",
                    "instances": i + 1
                }
            )
            db.add(deployment)
    
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
        }
    ]
    
    # Create template foundry items for each tenant
    for tenant in tenants:
        # Get a user from this tenant
        user = db.query(User).filter_by(tenant_id=tenant.id).first()
        if not user:
            continue
            
        for i, template_data in enumerate(foundry_templates):
            template_type = template_data["type"]
            
            foundry_item = TemplateFoundry(
                template_id=f"foundry-{i+1}-{tenant.tenant_id}",
                name=template_data["name"],
                description=template_data["description"],
                type=template_data["type"],
                provider=template_data["provider"],
                code=code_snippets.get(template_type, code_snippets["terraform"]),
                version="1.0.0",
                categories=template_data["categories"],
                is_published=template_data["is_published"],
                author=user.username,
                commit_id=f"commit-{i+1}-{tenant.tenant_id}",
                tenant_id=tenant.id,
                created_by_id=user.id
            )
            db.add(foundry_item)
    
    # Commit all changes
    db.commit()
    logger.info("Sample data created successfully")

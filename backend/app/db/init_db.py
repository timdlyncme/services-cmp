"""
Database initialization script.

This script creates initial data for the application, including:
- Roles and permissions
- Default tenants
- Admin user
"""

import logging
import uuid
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User, Role, Permission, Tenant
from app.models.deployment import CloudAccount, Environment, Template, Deployment

logger = logging.getLogger(__name__)

# Helper function to generate UUIDs
def generate_uuid():
    return str(uuid.uuid4())

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

# Default tenants with UUID-based tenant_ids
TENANTS = [
    {
        "name": "Acme Corp",
        "description": "Main corporate tenant",
        "tenant_id": generate_uuid()
    },
    {
        "name": "Dev Team",
        "description": "Development team workspace",
        "tenant_id": generate_uuid()
    },
    {
        "name": "Cloud Ops",
        "description": "Cloud operations team",
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
        "user_id": generate_uuid()
    },
    {
        "email": "user@example.com",
        "username": "user",
        "full_name": "Regular User",
        "password": "user123",  # This would be hashed in production
        "role": "user",
        "tenant": 0,  # Index in TENANTS list
        "user_id": generate_uuid()
    },
    {
        "email": "msp@example.com",
        "username": "msp",
        "full_name": "MSP User",
        "password": "msp123",  # This would be hashed in production
        "role": "msp",
        "tenant": 0,  # Index in TENANTS list
        "user_id": generate_uuid()
    },
    {
        "email": "dev@example.com",
        "username": "dev",
        "full_name": "Developer User",
        "password": "dev123",  # This would be hashed in production
        "role": "user",
        "tenant": 1,  # Index in TENANTS list
        "user_id": generate_uuid()
    },
    {
        "email": "ops@example.com",
        "username": "ops",
        "full_name": "Operations User",
        "password": "ops123",  # This would be hashed in production
        "role": "user",
        "tenant": 2,  # Index in TENANTS list
        "user_id": generate_uuid()
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
    for i, tenant_data in enumerate(TENANTS):
        tenant = db.query(Tenant).filter_by(name=tenant_data["name"]).first()
        if not tenant:
            tenant = Tenant(**tenant_data)
            db.add(tenant)
            db.flush()
        tenants[i] = tenant  # Store by index for user reference
        tenants[tenant.tenant_id] = tenant  # Also store by tenant_id for later reference
    
    # Create users
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
                    tenant_id=tenant.id,
                    user_id=user_data.get("user_id")
                )
                db.add(user)
    
    # Commit all changes
    db.commit()
    logger.info("Database initialized with default data")


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
        tenant_users = db.query(User).filter(User.tenant_id == tenant.id).all()
        if tenant_users:
            users_by_tenant[tenant.id] = tenant_users
    
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
                tenant_id=tenant.id
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
                        tenant_id=tenant.id
                    )
                    db.add(extra_account)
                    db.flush()
                    cloud_accounts.append(extra_account)
    
    # Create sample environments for each tenant
    environments = []
    for tenant in tenants:
        for env_name in ["Development", "Staging", "Production"]:
            environment = Environment(
                environment_id=generate_uuid(),
                name=f"{env_name} for {tenant.name}",
                description=f"{env_name} environment for {tenant.name}",
                tenant_id=tenant.id,
                # Add new fields with sample data
                update_strategy=["rolling", "blue-green", "canary"][len(environments) % 3],
                scaling_policies={
                    "min_instances": 1,
                    "max_instances": 5,
                    "cpu_threshold": 70,
                    "memory_threshold": 80
                },
                environment_variables={
                    "ENV": env_name.upper(),
                    "DEBUG": "true" if env_name == "Development" else "false",
                    "LOG_LEVEL": "DEBUG" if env_name == "Development" else "INFO"
                },
                logging_config={
                    "retention_days": 30,
                    "log_level": "DEBUG" if env_name == "Development" else "INFO",
                    "enable_application_insights": True
                },
                monitoring_integration={
                    "enable_alerts": True,
                    "alert_channels": ["email", "slack"],
                    "metrics_retention_days": 90
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
    for tenant in tenants:
        for i, (name, provider) in enumerate([
            ("Web App", "azure"),
            ("Database Cluster", "aws"),
            ("Kubernetes Cluster", "gcp"),
            ("Storage Account", "azure"),
            ("Lambda Function", "aws"),
            ("Virtual Machine", "azure"),
            ("Container Registry", "gcp")
        ]):
            template = Template(
                template_id=generate_uuid(),
                name=f"{name} for {tenant.name}",
                description=f"{name} template for {tenant.name}",
                category=["Compute", "Storage", "Database", "Networking", "Containers"][i % 5],
                provider=provider,
                is_public=i % 3 == 0,  # Every third template is public
                current_version="1.0.0",
                tenant_id=tenant.id
            )
            db.add(template)
            db.flush()
            templates.append(template)
            
            # Create template versions
            for version_num in range(1, 3):  # Create 2 versions for each template
                template_version = Template.versions.prop.entity.class_(
                    version=f"1.0.{version_num-1}",
                    changes=f"Version {version_num} changes",
                    code=f"# Sample template code for {name} version {version_num}",
                    template_id=template.id,
                    created_at=datetime.utcnow() - timedelta(days=30 - version_num * 10)
                )
                db.add(template_version)
            
            db.flush()
    
    # Create sample deployments for each tenant
    deployments = []
    for tenant in tenants:
        tenant_templates = [t for t in templates if t.tenant_id == tenant.id]
        tenant_environments = [e for e in environments if e.tenant_id == tenant.id]
        tenant_users = users_by_tenant.get(tenant.id, [])
        
        if not tenant_templates or not tenant_environments or not tenant_users:
            continue
        
        # Create multiple deployments per tenant
        for i in range(min(len(tenant_templates), len(tenant_environments))):
            template = tenant_templates[i]
            environment = tenant_environments[i % len(tenant_environments)]
            user = tenant_users[i % len(tenant_users)]
            
            # Create 2-3 deployments per template/environment combination
            for j in range(2 + (i % 2)):
                status = ["running", "pending", "stopped", "failed"][j % 4]
                
                deployment = Deployment(
                    deployment_id=generate_uuid(),
                    name=f"{template.name} Deployment {j+1}",
                    status=status,
                    template_id=template.id,
                    environment_id=environment.id,
                    tenant_id=tenant.id,
                    created_by_id=user.id,
                    created_at=datetime.utcnow() - timedelta(days=j*15),
                    updated_at=datetime.utcnow() - timedelta(days=j*10),
                    parameters={
                        "region": "us-east-1" if template.provider == "aws" else "eastus" if template.provider == "azure" else "us-central1",
                        "size": ["small", "medium", "large"][j % 3],
                        "instances": j + 1,
                        "tags": {
                            "environment": environment.name,
                            "owner": user.username,
                            "cost-center": f"cc-{tenant.tenant_id}-{j+1}"
                        }
                    }
                )
                db.add(deployment)
                db.flush()
                deployments.append(deployment)
                
                # Create deployment history
                from app.models.deployment import DeploymentHistory
                
                # Add multiple history entries for each deployment
                for k in range(3):
                    history_status = ["pending", "in_progress", "completed", "failed"][min(k, 3)]
                    if k == 2 and status == "failed":
                        history_status = "failed"
                    
                    history = DeploymentHistory(
                        deployment_id=deployment.id,
                        status=history_status,
                        message=f"Deployment {history_status} at step {k+1}",
                        created_at=deployment.created_at + timedelta(hours=k),
                        details={
                            "step": k+1,
                            "total_steps": 3,
                            "resources_created": k,
                            "logs": [f"Log entry {m+1} for step {k+1}" for m in range(3)]
                        }
                    )
                    db.add(history)
                
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
  kind: 'StorageV2'
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
        tenant_users = users_by_tenant.get(tenant.id, [])
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
                tenant_id=tenant.id,
                created_by_id=user.id,
                created_at=created_at,
                updated_at=updated_at
            )
            db.add(foundry_item)
    
    # Commit all changes
    db.commit()
    logger.info("Comprehensive sample data created successfully")

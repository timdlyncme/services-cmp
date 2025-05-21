"""
Database initialization script.

This script creates initial data for the application, including:
- Roles and permissions
- Default tenants
- Admin user
"""

import logging
from sqlalchemy.orm import Session
from datetime import datetime, timedelta

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
            
            # Create additional accounts for more variety
            if i == 0:  # For Azure, create multiple accounts
                for j in range(2):
                    extra_account = CloudAccount(
                        account_id=f"{provider}-extra-{j+1}-{tenant.tenant_id}",
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
                environment_id=f"{env_name.lower()}-env-{tenant.tenant_id}",
                name=f"{env_name} for {tenant.name}",
                description=f"{env_name} environment for {tenant.name}",
                tenant_id=tenant.id,
                update_strategy="rolling",
                scaling_policies={"min": 1, "max": 5, "target_cpu": 70},
                environment_variables={"ENV": env_name.upper(), "DEBUG": env_name != "Production"},
                logging_config={"level": "INFO", "retention_days": 30},
                monitoring_integration={"enabled": True, "metrics": ["cpu", "memory", "network"]}
            )
            db.add(environment)
            db.flush()
            environments.append(environment)
        
        # Create additional specialized environments
        specialized_envs = [
            {
                "name": "QA",
                "description": "Quality Assurance environment",
                "update_strategy": "blue-green",
                "scaling_policies": {"min": 2, "max": 4, "target_cpu": 60},
                "environment_variables": {"ENV": "QA", "DEBUG": True, "TESTING": True}
            },
            {
                "name": "Demo",
                "description": "Customer demonstration environment",
                "update_strategy": "canary",
                "scaling_policies": {"min": 1, "max": 3, "target_cpu": 50},
                "environment_variables": {"ENV": "DEMO", "DEBUG": False, "DEMO_MODE": True}
            }
        ]
        
        for env_data in specialized_envs:
            environment = Environment(
                environment_id=f"{env_data['name'].lower()}-env-{tenant.tenant_id}",
                name=f"{env_data['name']} for {tenant.name}",
                description=env_data["description"],
                tenant_id=tenant.id,
                update_strategy=env_data["update_strategy"],
                scaling_policies=env_data["scaling_policies"],
                environment_variables=env_data["environment_variables"],
                logging_config={"level": "DEBUG", "retention_days": 15},
                monitoring_integration={"enabled": True, "metrics": ["cpu", "memory", "disk", "network"]}
            )
            db.add(environment)
            db.flush()
            environments.append(environment)
    
    # Associate cloud accounts with environments
    # Each tenant gets their own associations
    for tenant in tenants:
        tenant_environments = [env for env in environments if env.tenant_id == tenant.id]
        tenant_accounts = [acc for acc in cloud_accounts if acc.tenant_id == tenant.id]
        
        if not tenant_environments or not tenant_accounts:
            continue
        
        # Development environment gets Azure
        if len(tenant_environments) > 0 and len(tenant_accounts) > 0:
            tenant_environments[0].cloud_accounts.append(tenant_accounts[0])
        
        # Staging environment gets AWS
        if len(tenant_environments) > 1 and len(tenant_accounts) > 1:
            tenant_environments[1].cloud_accounts.append(tenant_accounts[1])
        
        # Production environment gets Azure and GCP
        if len(tenant_environments) > 2 and len(tenant_accounts) > 2:
            tenant_environments[2].cloud_accounts.append(tenant_accounts[0])
            tenant_environments[2].cloud_accounts.append(tenant_accounts[2])
        
        # QA environment gets AWS and GCP
        if len(tenant_environments) > 3 and len(tenant_accounts) > 2:
            tenant_environments[3].cloud_accounts.append(tenant_accounts[1])
            tenant_environments[3].cloud_accounts.append(tenant_accounts[2])
        
        # Demo environment gets all accounts
        if len(tenant_environments) > 4:
            for account in tenant_accounts:
                tenant_environments[4].cloud_accounts.append(account)
    
    # Create sample templates for each tenant
    templates = []
    template_data = [
        {
            "name": "Web App",
            "description": "Basic web application template",
            "category": "Web",
            "provider": "azure",
            "versions": ["1.0.0", "1.1.0", "2.0.0"]
        },
        {
            "name": "Database Cluster",
            "description": "Managed database cluster",
            "category": "Database",
            "provider": "aws",
            "versions": ["1.0.0", "1.2.0"]
        },
        {
            "name": "Kubernetes Cluster",
            "description": "Managed Kubernetes service",
            "category": "Containers",
            "provider": "gcp",
            "versions": ["1.0.0", "1.5.0", "2.0.0", "2.1.0"]
        },
        {
            "name": "Static Website",
            "description": "Static website hosting",
            "category": "Web",
            "provider": "aws",
            "versions": ["1.0.0"]
        },
        {
            "name": "Virtual Machine Scale Set",
            "description": "Autoscaling VM group",
            "category": "Compute",
            "provider": "azure",
            "versions": ["1.0.0", "1.1.0", "1.2.0"]
        },
        {
            "name": "Serverless Function",
            "description": "Serverless function deployment",
            "category": "Serverless",
            "provider": "azure",
            "versions": ["1.0.0", "2.0.0"]
        },
        {
            "name": "Container Registry",
            "description": "Private container registry",
            "category": "Containers",
            "provider": "gcp",
            "versions": ["1.0.0"]
        },
        {
            "name": "Network Infrastructure",
            "description": "Virtual network with subnets",
            "category": "Networking",
            "provider": "aws",
            "versions": ["1.0.0", "1.1.0"]
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
                tenant_id=tenant.id,
                current_version=data["versions"][-1]
            )
            db.add(template)
            db.flush()
            templates.append(template)
            
            # Create template versions
            for j, version in enumerate(data["versions"]):
                from app.models.deployment import TemplateVersion
                
                template_version = TemplateVersion(
                    version=version,
                    template_id=template.id,
                    changes=f"Version {version} changes for {data['name']}",
                    created_at=datetime.utcnow() - timedelta(days=(len(data["versions"]) - j) * 30)
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
                    deployment_id=f"deployment-{i+1}-{j+1}-{tenant.tenant_id}",
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
                template_id=f"foundry-{i+1}-{tenant.tenant_id}",
                name=template_data["name"],
                description=f"{template_data['description']} for {tenant.name}",
                type=template_data["type"],
                provider=template_data["provider"],
                code=code_snippets.get(template_type, code_snippets["terraform"]),
                version="1.0.0",
                categories=template_data["categories"],
                is_published=template_data["is_published"],
                author=user.username,
                commit_id=f"commit-{i+1}-{tenant.tenant_id}",
                tenant_id=tenant.id,
                created_by_id=user.id,
                created_at=created_at,
                updated_at=updated_at
            )
            db.add(foundry_item)
    
    # Commit all changes
    db.commit()
    logger.info("Comprehensive sample data created successfully")

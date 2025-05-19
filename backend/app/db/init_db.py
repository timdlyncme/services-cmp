import logging
from sqlalchemy.orm import Session
import uuid
from datetime import datetime, timedelta
import time
import json
from sqlalchemy import text

from app.core.security import get_password_hash
from app.db.session import engine, SessionLocal
from app.models.base_models import Base
from app.models.user import User, Role, Permission, Tenant
from app.models.deployment import Deployment, CloudAccount, Environment, Template
from app.models.integration import IntegrationConfig

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init_db() -> None:
    """
    Initialize the database with some data
    """
    # Wait for database to be ready
    max_retries = 10
    retry_interval = 3
    
    for i in range(max_retries):
        try:
            # Try to connect to the database
            db = SessionLocal()
            db.execute(text("SELECT 1"))  # Use SQLAlchemy text() function
            db.close()
            logger.info("Database connection successful")
            break
        except Exception as e:
            logger.warning(f"Database connection attempt {i+1}/{max_retries} failed: {e}")
            if i < max_retries - 1:
                logger.info(f"Retrying in {retry_interval} seconds...")
                time.sleep(retry_interval)
            else:
                logger.error("Failed to connect to database after multiple attempts")
                raise
    
    db = SessionLocal()
    
    try:
        # Create tables
        Base.metadata.create_all(bind=engine)
        
        # Check if database is already initialized
        if db.query(User).first():
            logger.info("Database already initialized")
            return
        
        # Create permissions
        logger.info("Creating permissions")
        permissions = {
            # Tenant permissions
            "view:tenants": db.merge(Permission(name="view:tenants", description="View tenants")),
            "create:tenants": db.merge(Permission(name="create:tenants", description="Create tenants")),
            "update:tenants": db.merge(Permission(name="update:tenants", description="Update tenants")),
            "delete:tenants": db.merge(Permission(name="delete:tenants", description="Delete tenants")),
            
            # Permission management
            "view:permissions": db.merge(Permission(name="view:permissions", description="View permissions")),
            "create:permissions": db.merge(Permission(name="create:permissions", description="Create permissions")),
            "update:permissions": db.merge(Permission(name="update:permissions", description="Update permissions")),
            "delete:permissions": db.merge(Permission(name="delete:permissions", description="Delete permissions")),
            
            # NexusAI permissions
            "use:nexus_ai": db.merge(Permission(name="use:nexus_ai", description="Use NexusAI")),
            "manage:nexus_ai": db.merge(Permission(name="manage:nexus_ai", description="Manage NexusAI")),
            
            # Dashboard permissions
            "view:dashboard": db.merge(Permission(name="view:dashboard", description="View dashboard")),
            
            # Catalog permissions
            "view:catalog": db.merge(Permission(name="view:catalog", description="View template catalog")),
            "use:catalog": db.merge(Permission(name="use:catalog", description="Use template catalog")),
            
            # Deployment permissions
            "view:deployments": db.merge(Permission(name="view:deployments", description="View deployments")),
            "create:deployments": db.merge(Permission(name="create:deployments", description="Create deployments")),
            "update:deployments": db.merge(Permission(name="update:deployments", description="Update deployments")),
            "delete:deployments": db.merge(Permission(name="delete:deployments", description="Delete deployments")),
            
            # Cloud account permissions
            "view:cloud-accounts": db.merge(Permission(name="view:cloud-accounts", description="View cloud accounts")),
            "create:cloud-accounts": db.merge(Permission(name="create:cloud-accounts", description="Create cloud accounts")),
            "update:cloud-accounts": db.merge(Permission(name="update:cloud-accounts", description="Update cloud accounts")),
            "delete:cloud-accounts": db.merge(Permission(name="delete:cloud-accounts", description="Delete cloud accounts")),
            
            # Environment permissions
            "view:environments": db.merge(Permission(name="view:environments", description="View environments")),
            "create:environments": db.merge(Permission(name="create:environments", description="Create environments")),
            "update:environments": db.merge(Permission(name="update:environments", description="Update environments")),
            "delete:environments": db.merge(Permission(name="delete:environments", description="Delete environments")),
            
            # Template permissions
            "view:templates": db.merge(Permission(name="view:templates", description="View templates")),
            "create:templates": db.merge(Permission(name="create:templates", description="Create templates")),
            "update:templates": db.merge(Permission(name="update:templates", description="Update templates")),
            "delete:templates": db.merge(Permission(name="delete:templates", description="Delete templates")),
            "manage:templates": db.merge(Permission(name="manage:templates", description="Manage templates")),
            
            # User management permissions
            "view:users": db.merge(Permission(name="view:users", description="View users and groups")),
            "create:users": db.merge(Permission(name="create:users", description="Create users and groups")),
            "update:users": db.merge(Permission(name="update:users", description="Update users and groups")),
            "delete:users": db.merge(Permission(name="delete:users", description="Delete users and groups")),
            
            # Settings permissions
            "view:settings": db.merge(Permission(name="view:settings", description="View settings")),
            "update:settings": db.merge(Permission(name="update:settings", description="Update settings")),
        }
        
        # Create roles
        logger.info("Creating roles")
        admin_role = Role(name="admin")
        admin_role.permissions = list(permissions.values())
        db.add(admin_role)
        
        user_role = Role(name="user")
        user_role.permissions = [
            permissions["view:tenants"],
            permissions["view:dashboard"],
            permissions["view:catalog"],
            permissions["use:catalog"],
            permissions["view:deployments"],
            permissions["create:deployments"],
            permissions["update:deployments"],
            permissions["delete:deployments"],
            permissions["use:nexus_ai"],
        ]
        db.add(user_role)
        
        msp_role = Role(name="msp")
        msp_role.permissions = list(permissions.values())
        db.add(msp_role)
        
        # Commit roles to the database so they have IDs
        db.commit()
        logger.info("Roles created and committed to database")
        
        # Create tenants
        logger.info("Creating tenants")
        default_tenant = Tenant(
            tenant_id="tenant-1",
            name="Solutions Development",
            description="Solutions Development tenant"
        )
        db.add(default_tenant)
        
        acme_tenant = Tenant(
            tenant_id="tenant-2",
            name="Acme Corporation",
            description="Enterprise customer with multiple cloud accounts"
        )
        db.add(acme_tenant)
        
        startup_tenant = Tenant(
            tenant_id="tenant-3",
            name="Tech Startup",
            description="Small tech startup with limited cloud resources"
        )
        db.add(startup_tenant)
        
        # Commit tenants to the database so they have IDs
        db.commit()
        logger.info("Tenants created and committed to database")
        
        # Create users
        logger.info("Creating users")
        admin_user = User(
            user_id="admin",
            name="Admin User",
            email="admin@example.com",
            hashed_password=get_password_hash("admin"),
            role=admin_role,
            tenant=default_tenant
        )
        db.add(admin_user)
        
        test_user = User(
            user_id="user",
            name="Test User",
            email="user@example.com",
            hashed_password=get_password_hash("user"),
            role=user_role,
            tenant=acme_tenant
        )
        db.add(test_user)
        
        msp_user = User(
            user_id="msp",
            name="MSP Admin",
            email="msp@example.com",
            hashed_password=get_password_hash("msp"),
            role=msp_role,
            tenant=default_tenant
        )
        db.add(msp_user)
        
        acme_admin = User(
            user_id="acme_admin",
            name="Acme Admin",
            email="acme.admin@example.com",
            hashed_password=get_password_hash("password"),
            role=admin_role,
            tenant=acme_tenant
        )
        db.add(acme_admin)
        
        acme_user = User(
            user_id="acme_user",
            name="Acme User",
            email="acme.user@example.com",
            hashed_password=get_password_hash("password"),
            role=user_role,
            tenant=acme_tenant
        )
        db.add(acme_user)
        
        startup_admin = User(
            user_id="startup_admin",
            name="Startup Admin",
            email="startup.admin@example.com",
            hashed_password=get_password_hash("password"),
            role=admin_role,
            tenant=startup_tenant
        )
        db.add(startup_admin)
        
        # Commit users to the database so they have IDs
        db.commit()
        logger.info("Users created and committed to database")
        
        # Create cloud accounts from mock data
        logger.info("Creating cloud accounts from mock data")
        
        # Mock cloud accounts data
        mock_cloud_accounts = [
            {
                "id": "account-1",
                "name": "Production Azure",
                "provider": "azure",
                "status": "connected",
                "tenantId": "tenant-1",
            },
            {
                "id": "account-2",
                "name": "Development AWS",
                "provider": "aws",
                "status": "connected",
                "tenantId": "tenant-1",
            },
            {
                "id": "account-3",
                "name": "GCP Research",
                "provider": "gcp",
                "status": "warning",
                "tenantId": "tenant-2",
            },
            {
                "id": "account-4",
                "name": "Dev Team Azure",
                "provider": "azure",
                "status": "connected",
                "tenantId": "tenant-3",
            },
            {
                "id": "account-5",
                "name": "GCP Production",
                "provider": "gcp",
                "status": "warning",
                "tenantId": "tenant-1",
            },
            {
                "id": "account-6",
                "name": "Azure Dev",
                "provider": "azure",
                "status": "connected",
                "tenantId": "tenant-2",
            },
            {
                "id": "account-7",
                "name": "AWS Lab Account",
                "provider": "aws",
                "status": "connected",
                "tenantId": "tenant-3",
            },
            {
                "id": "account-8",
                "name": "GCP Production",
                "provider": "gcp",
                "status": "warning",
                "tenantId": "tenant-3",
            },
            
        ]
        
        cloud_accounts = {}
        for account_data in mock_cloud_accounts:
            tenant = db.query(Tenant).filter(Tenant.tenant_id == account_data["tenantId"]).first()
            if tenant:
                account = CloudAccount(
                    account_id=account_data["id"],
                    name=account_data["name"],
                    provider=account_data["provider"],
                    status=account_data["status"],
                    tenant=tenant
                )
                db.add(account)
                cloud_accounts[account_data["id"]] = account
        
        # Commit cloud accounts to the database so they have IDs
        db.commit()
        logger.info("Cloud accounts created and committed to database")
        
        # Create environments
        logger.info("Creating environments")
        
        # Mock environments data
        mock_environments = [
            {
                "id": "env-1",
                "name": "Production",
                "description": "Main production environment with strict security policies",
                "tenantId": "tenant-1"
            },
            {
                "id": "env-2",
                "name": "Development",
                "description": "Development environment for testing new features",
                "tenantId": "tenant-1"
            },
            {
                "id": "env-3",
                "name": "Testing",
                "description": "QA testing environment",
                "tenantId": "tenant-2"
            },
            {
                "id": "env-4",
                "name": "Production",
                "description": "Production environment",
                "tenantId": "tenant-3"
            },
            {
                "id": "env-5",
                "name": "Development",
                "description": "Development environment",
                "tenantId": "tenant-3"
            }
        ]
        
        environments = {}
        for env_data in mock_environments:
            tenant = db.query(Tenant).filter(Tenant.tenant_id == env_data["tenantId"]).first()
            if tenant:
                environment = Environment(
                    environment_id=env_data["id"],
                    name=env_data["name"],
                    description=env_data["description"],
                    tenant=tenant
                )
                db.add(environment)
                environments[env_data["id"]] = environment
        
        # Commit environments to the database so they have IDs
        db.commit()
        logger.info("Environments created and committed to database")
        
        # Create templates from mock data
        logger.info("Creating templates from mock data")
        
        # Import mock data from JSON file
        import json
        import os
        
        # Path to the mock data file
        mock_data_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "mock-data.json")
        
        # Read the mock data file
        try:
            with open(mock_data_path, "r") as f:
                mock_data = json.load(f)
                
            mock_templates_data = mock_data.get("templates", [])
            mock_deployments_data = mock_data.get("deployments", [])
            mock_integration_configs_data = mock_data.get("integrationConfigs", [])
            
            logger.info(f"Successfully loaded mock data: {len(mock_templates_data)} templates, {len(mock_deployments_data)} deployments, {len(mock_integration_configs_data)} integration configs")
        except Exception as e:
            logger.error(f"Error reading mock data file: {str(e)}")
            # Fallback to default mock data
            mock_templates_data = []
            mock_deployments_data = []
            mock_integration_configs_data = []
        
        # Mock templates data (fallback if file reading fails)
        if not mock_templates_data:
            mock_templates_data = [
                {
                    "id": "template-1",
                    "name": "Basic Web Application",
                    "description": "Deploys a simple web application with supporting infrastructure",
                    "type": "terraform",
                    "provider": "azure",
                    "categories": ["web", "basic"],
                    "tenantId": "tenant-1",
                },
                {
                    "id": "template-2",
                    "name": "Containerized Microservices",
                    "description": "Kubernetes cluster for microservices deployment",
                    "type": "terraform",
                    "provider": "aws",
                    "categories": ["kubernetes", "microservices", "containers"],
                    "tenantId": "tenant-1",
                },
                {
                    "id": "template-3",
                    "name": "Google Cloud Storage with CDN",
                    "description": "Static website hosting with CDN",
                    "type": "terraform",
                    "provider": "gcp",
                    "categories": ["storage", "cdn", "static-site"],
                    "tenantId": "tenant-1",
                },
                {
                    "id": "template-4",
                    "name": "Virtual Machine Scale Set",
                    "description": "Autoscaling VMs for high availability",
                    "type": "arm",
                    "provider": "azure",
                    "categories": ["virtual-machines", "autoscaling", "high-availability"],
                    "tenantId": "tenant-2",
                },
                {
                    "id": "template-5",
                    "name": "S3 Static Website",
                    "description": "Simple S3 bucket configured for website hosting",
                    "type": "cloudformation",
                    "provider": "aws",
                    "categories": ["storage", "static-site", "web"],
                    "tenantId": "tenant-2",
                },
                {
                    "id": "template-6",
                    "name": "Cloud SQL Database",
                    "description": "Managed PostgreSQL database on GCP",
                    "type": "terraform",
                    "provider": "gcp",
                    "categories": ["database", "postgresql"],
                    "tenantId": "tenant-3",
                }
            ]
        
        templates = {}
        for template_data in mock_templates_data:
            tenant = db.query(Tenant).filter(Tenant.tenant_id == template_data["tenantId"]).first()
            if tenant:
                template = Template(
                    template_id=template_data["id"],
                    name=template_data["name"],
                    description=template_data["description"],
                    category=template_data["categories"][0] if template_data["categories"] else "general",
                    provider=template_data["provider"],
                    is_public=False,
                    tenant_id=tenant.id,
                    code=template_data.get("code", "")  # Add template code
                )
                db.add(template)
                templates[template_data["id"]] = template
            else:
                logger.warning(f"Tenant {template_data['tenantId']} not found, skipping template {template_data['id']}")
        
        db.commit()
        logger.info(f"Created {len(templates)} templates")
        
        # Create deployments from mock data
        logger.info("Creating deployments from mock data")
        
        # Debug: List all tenants in the database
        tenants = db.query(Tenant).all()
        logger.info(f"Available tenants: {[t.tenant_id for t in tenants]}")
        
        # Use mock deployments data from the frontend
        deployments = []
        for deployment_data in mock_deployments_data:
            tenant = db.query(Tenant).filter(Tenant.tenant_id == deployment_data["tenantId"]).first()
            if not tenant:
                logger.warning(f"Tenant {deployment_data['tenantId']} not found, skipping deployment {deployment_data['id']}")
                continue
                
            template = templates.get(deployment_data["templateId"])
            if not template:
                logger.warning(f"Template {deployment_data['templateId']} not found, skipping deployment {deployment_data['id']}")
                continue
                
            # Find or create environment
            environment_name = deployment_data["environment"]
            environment = db.query(Environment).filter(
                Environment.name == environment_name,
                Environment.tenant_id == tenant.id
            ).first()
            
            if not environment:
                # Create environment if it doesn't exist
                import uuid
                environment = Environment(
                    environment_id=str(uuid.uuid4()),
                    name=environment_name,
                    description=f"{environment_name} environment",
                    tenant_id=tenant.id
                )
                db.add(environment)
                db.commit()
                logger.info(f"Created new environment: {environment_name}")
            
            # Find cloud account for provider
            cloud_account = db.query(CloudAccount).filter(
                CloudAccount.provider == deployment_data["provider"],
                CloudAccount.tenant_id == tenant.id
            ).first()
            
            if not cloud_account:
                logger.warning(f"No cloud account found for provider {deployment_data['provider']} and tenant {tenant.tenant_id}, skipping deployment {deployment_data['id']}")
                continue
            
            # Create deployment
            deployment = Deployment(
                deployment_id=deployment_data["id"],
                name=deployment_data["name"],
                status=deployment_data["status"],
                template_id=template.id,
                environment_id=environment.id,
                cloud_account_id=cloud_account.id,
                tenant_id=tenant.id,
                created_by_id=admin_user.id,
                created_at=datetime.fromisoformat(deployment_data["createdAt"].replace("Z", "+00:00")),
                updated_at=datetime.fromisoformat(deployment_data["updatedAt"].replace("Z", "+00:00")),
                parameters=deployment_data.get("parameters", {}),
                resources=deployment_data.get("resources", []),
                region=deployment_data.get("region", "us-east-1")
            )
            db.add(deployment)
            deployments.append(deployment)
        
        db.commit()
        logger.info(f"Created {len(deployments)} deployments")
        
        # Create integration configs from mock data
        logger.info("Creating integration configs from mock data")
        
        # Debug: List all tenants in the database again
        tenants = db.query(Tenant).all()
        logger.info(f"Available tenants for integrations: {[t.tenant_id for t in tenants]}")
        
        # Use mock integration configs data from the JSON file
        integration_configs = []
        for config_data in mock_integration_configs_data:
            tenant = db.query(Tenant).filter(Tenant.tenant_id == config_data["tenantId"]).first()
            if not tenant:
                logger.warning(f"Tenant {config_data['tenantId']} not found, skipping integration config {config_data['id']}")
                continue
            
            integration_config = IntegrationConfig(
                integration_id=config_data["id"],
                name=config_data["name"],
                type=config_data["type"],
                provider=config_data["provider"],
                status=config_data["status"],
                last_checked=datetime.fromisoformat(config_data.get("lastChecked", datetime.utcnow().isoformat()).replace("Z", "+00:00")),
                settings=config_data.get("settings", {}),
                tenant_id=tenant.id
            )
            db.add(integration_config)
            integration_configs.append(integration_config)
        
        db.commit()
        logger.info(f"Created {len(integration_configs)} integration configs")
        
        # Final success message
        logger.info("Database successfully initialized with mock data")
    
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        db.rollback()
        raise
    
    finally:
        db.close()


if __name__ == "__main__":
    logger.info("Initializing database")
    init_db()

import logging
from sqlalchemy.orm import Session
import uuid
from datetime import datetime, timedelta
import time

from app.core.security import get_password_hash
from app.db.session import Base, engine, SessionLocal
from app.models.user import User, Role, Permission, Tenant
from app.models.deployment import Deployment, CloudAccount, Environment, Template

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
            db.execute("SELECT 1")
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
        
        # Create tenants
        logger.info("Creating tenants")
        default_tenant = Tenant(
            tenant_id="default",
            name="Default Tenant",
            description="Default tenant for all users"
        )
        db.add(default_tenant)
        
        acme_tenant = Tenant(
            tenant_id="acme",
            name="Acme Corporation",
            description="Enterprise customer with multiple cloud accounts"
        )
        db.add(acme_tenant)
        
        startup_tenant = Tenant(
            tenant_id="startup",
            name="Tech Startup",
            description="Small tech startup with limited cloud resources"
        )
        db.add(startup_tenant)
        
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
            tenant=default_tenant
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
        
        # Create cloud accounts
        logger.info("Creating cloud accounts")
        
        # Default tenant cloud accounts
        default_azure = CloudAccount(
            account_id=str(uuid.uuid4()),
            name="Default Azure Account",
            provider="azure",
            status="connected",
            tenant=default_tenant
        )
        db.add(default_azure)
        
        default_aws = CloudAccount(
            account_id=str(uuid.uuid4()),
            name="Default AWS Account",
            provider="aws",
            status="connected",
            tenant=default_tenant
        )
        db.add(default_aws)
        
        # Acme tenant cloud accounts
        acme_azure_prod = CloudAccount(
            account_id=str(uuid.uuid4()),
            name="Acme Azure Production",
            provider="azure",
            status="connected",
            tenant=acme_tenant
        )
        db.add(acme_azure_prod)
        
        acme_azure_dev = CloudAccount(
            account_id=str(uuid.uuid4()),
            name="Acme Azure Development",
            provider="azure",
            status="connected",
            tenant=acme_tenant
        )
        db.add(acme_azure_dev)
        
        acme_aws = CloudAccount(
            account_id=str(uuid.uuid4()),
            name="Acme AWS Account",
            provider="aws",
            status="warning",
            tenant=acme_tenant
        )
        db.add(acme_aws)
        
        acme_gcp = CloudAccount(
            account_id=str(uuid.uuid4()),
            name="Acme GCP Account",
            provider="gcp",
            status="error",
            tenant=acme_tenant
        )
        db.add(acme_gcp)
        
        # Startup tenant cloud accounts
        startup_azure = CloudAccount(
            account_id=str(uuid.uuid4()),
            name="Startup Azure Account",
            provider="azure",
            status="connected",
            tenant=startup_tenant
        )
        db.add(startup_azure)
        
        # Create environments
        logger.info("Creating environments")
        
        # Default tenant environments
        default_prod = Environment(
            environment_id=str(uuid.uuid4()),
            name="Production",
            description="Production environment",
            tenant=default_tenant
        )
        db.add(default_prod)
        
        default_dev = Environment(
            environment_id=str(uuid.uuid4()),
            name="Development",
            description="Development environment",
            tenant=default_tenant
        )
        db.add(default_dev)
        
        # Acme tenant environments
        acme_prod = Environment(
            environment_id=str(uuid.uuid4()),
            name="Production",
            description="Production environment",
            tenant=acme_tenant
        )
        db.add(acme_prod)
        
        acme_staging = Environment(
            environment_id=str(uuid.uuid4()),
            name="Staging",
            description="Staging environment",
            tenant=acme_tenant
        )
        db.add(acme_staging)
        
        acme_dev = Environment(
            environment_id=str(uuid.uuid4()),
            name="Development",
            description="Development environment",
            tenant=acme_tenant
        )
        db.add(acme_dev)
        
        acme_test = Environment(
            environment_id=str(uuid.uuid4()),
            name="Testing",
            description="Testing environment",
            tenant=acme_tenant
        )
        db.add(acme_test)
        
        # Startup tenant environments
        startup_prod = Environment(
            environment_id=str(uuid.uuid4()),
            name="Production",
            description="Production environment",
            tenant=startup_tenant
        )
        db.add(startup_prod)
        
        startup_dev = Environment(
            environment_id=str(uuid.uuid4()),
            name="Development",
            description="Development environment",
            tenant=startup_tenant
        )
        db.add(startup_dev)
        
        # Create templates
        logger.info("Creating templates")
        
        # Common templates available to all tenants
        web_app_template = Template(
            template_id=str(uuid.uuid4()),
            name="Web Application",
            description="Basic web application with database",
            category="Web",
            provider="azure",
            is_public=True
        )
        db.add(web_app_template)
        
        data_analytics_template = Template(
            template_id=str(uuid.uuid4()),
            name="Data Analytics Platform",
            description="Data lake and analytics platform",
            category="Data",
            provider="azure",
            is_public=True
        )
        db.add(data_analytics_template)
        
        kubernetes_template = Template(
            template_id=str(uuid.uuid4()),
            name="Kubernetes Cluster",
            description="Managed Kubernetes cluster",
            category="Container",
            provider="azure",
            is_public=True
        )
        db.add(kubernetes_template)
        
        # Tenant-specific templates
        acme_custom_template = Template(
            template_id=str(uuid.uuid4()),
            name="Acme Custom App",
            description="Custom application for Acme Corp",
            category="Custom",
            provider="azure",
            is_public=False,
            tenant=acme_tenant
        )
        db.add(acme_custom_template)
        
        # Create deployments
        logger.info("Creating deployments")
        
        # Default tenant deployments
        default_deployment1 = Deployment(
            deployment_id=str(uuid.uuid4()),
            name="Web App Production",
            status="succeeded",
            created_at=datetime.utcnow() - timedelta(days=10),
            updated_at=datetime.utcnow() - timedelta(days=10),
            template=web_app_template,
            environment=default_prod,
            cloud_account=default_azure,
            tenant=default_tenant,
            created_by=admin_user
        )
        db.add(default_deployment1)
        
        default_deployment2 = Deployment(
            deployment_id=str(uuid.uuid4()),
            name="Data Analytics Dev",
            status="running",
            created_at=datetime.utcnow() - timedelta(hours=2),
            updated_at=datetime.utcnow() - timedelta(hours=2),
            template=data_analytics_template,
            environment=default_dev,
            cloud_account=default_azure,
            tenant=default_tenant,
            created_by=admin_user
        )
        db.add(default_deployment2)
        
        # Acme tenant deployments
        acme_deployment1 = Deployment(
            deployment_id=str(uuid.uuid4()),
            name="Web Application Cluster",
            status="succeeded",
            created_at=datetime.utcnow() - timedelta(days=30),
            updated_at=datetime.utcnow() - timedelta(days=15),
            template=web_app_template,
            environment=acme_prod,
            cloud_account=acme_azure_prod,
            tenant=acme_tenant,
            created_by=acme_admin
        )
        db.add(acme_deployment1)
        
        acme_deployment2 = Deployment(
            deployment_id=str(uuid.uuid4()),
            name="Data Platform",
            status="succeeded",
            created_at=datetime.utcnow() - timedelta(days=20),
            updated_at=datetime.utcnow() - timedelta(days=20),
            template=data_analytics_template,
            environment=acme_prod,
            cloud_account=acme_azure_prod,
            tenant=acme_tenant,
            created_by=acme_admin
        )
        db.add(acme_deployment2)
        
        acme_deployment3 = Deployment(
            deployment_id=str(uuid.uuid4()),
            name="Dev Kubernetes",
            status="failed",
            created_at=datetime.utcnow() - timedelta(days=5),
            updated_at=datetime.utcnow() - timedelta(days=5),
            template=kubernetes_template,
            environment=acme_dev,
            cloud_account=acme_azure_dev,
            tenant=acme_tenant,
            created_by=acme_user
        )
        db.add(acme_deployment3)
        
        acme_deployment4 = Deployment(
            deployment_id=str(uuid.uuid4()),
            name="Custom Application",
            status="running",
            created_at=datetime.utcnow() - timedelta(hours=6),
            updated_at=datetime.utcnow() - timedelta(hours=6),
            template=acme_custom_template,
            environment=acme_staging,
            cloud_account=acme_azure_dev,
            tenant=acme_tenant,
            created_by=acme_admin
        )
        db.add(acme_deployment4)
        
        # Startup tenant deployments
        startup_deployment1 = Deployment(
            deployment_id=str(uuid.uuid4()),
            name="Web Application",
            status="succeeded",
            created_at=datetime.utcnow() - timedelta(days=15),
            updated_at=datetime.utcnow() - timedelta(days=15),
            template=web_app_template,
            environment=startup_prod,
            cloud_account=startup_azure,
            tenant=startup_tenant,
            created_by=startup_admin
        )
        db.add(startup_deployment1)
        
        db.commit()
        logger.info("Database initialized")
    
    except Exception as e:
        logger.error(f"Error initializing database: {e}")
        db.rollback()
        raise
    
    finally:
        db.close()


if __name__ == "__main__":
    logger.info("Initializing database")
    init_db()

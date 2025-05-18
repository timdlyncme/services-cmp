import logging
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.db.session import Base, engine, SessionLocal
from app.models.user import User, Role, Permission, Tenant

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def init_db() -> None:
    """
    Initialize the database with some data
    """
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
            "view:tenants": db.merge(Permission(name="view:tenants", description="View tenants")),
            "create:tenants": db.merge(Permission(name="create:tenants", description="Create tenants")),
            "update:tenants": db.merge(Permission(name="update:tenants", description="Update tenants")),
            "delete:tenants": db.merge(Permission(name="delete:tenants", description="Delete tenants")),
            "view:permissions": db.merge(Permission(name="view:permissions", description="View permissions")),
            "create:permissions": db.merge(Permission(name="create:permissions", description="Create permissions")),
            "update:permissions": db.merge(Permission(name="update:permissions", description="Update permissions")),
            "delete:permissions": db.merge(Permission(name="delete:permissions", description="Delete permissions")),
            "use:nexus_ai": db.merge(Permission(name="use:nexus_ai", description="Use NexusAI")),
            "manage:nexus_ai": db.merge(Permission(name="manage:nexus_ai", description="Manage NexusAI")),
        }
        
        # Create roles
        logger.info("Creating roles")
        admin_role = Role(name="admin")
        admin_role.permissions = list(permissions.values())
        db.add(admin_role)
        
        user_role = Role(name="user")
        user_role.permissions = [
            permissions["view:tenants"],
            permissions["use:nexus_ai"],
        ]
        db.add(user_role)
        
        # Create tenants
        logger.info("Creating tenants")
        default_tenant = Tenant(
            tenant_id="default",
            name="Default Tenant",
            description="Default tenant for all users"
        )
        db.add(default_tenant)
        
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

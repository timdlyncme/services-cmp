from sqlalchemy.orm import Session

from app.db.session import Base, engine
from app.models.user import User, Role, Permission, Tenant, user_permissions, role_permissions


def init_db(db: Session) -> None:
    """
    Initialize the database with default data
    """
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Check if we already have data
    if db.query(User).first():
        return
    
    # Create default tenants
    default_tenant = Tenant(
        tenant_id="default",
        name="Default Tenant",
        description="Default tenant for the system"
    )
    
    acme_tenant = Tenant(
        tenant_id="acme",
        name="Acme Corporation",
        description="Acme Corporation tenant"
    )
    
    db.add(default_tenant)
    db.add(acme_tenant)
    db.flush()
    
    # Create default permissions
    view_dashboard = Permission(
        name="view:dashboard",
        description="View dashboard"
    )
    
    manage_users = Permission(
        name="manage:users",
        description="Manage users"
    )
    
    manage_tenants = Permission(
        name="manage:tenants",
        description="Manage tenants"
    )
    
    view_templates = Permission(
        name="view:templates",
        description="View templates"
    )
    
    manage_templates = Permission(
        name="manage:templates",
        description="Manage templates"
    )
    
    view_deployments = Permission(
        name="view:deployments",
        description="View deployments"
    )
    
    manage_deployments = Permission(
        name="manage:deployments",
        description="Manage deployments"
    )
    
    use_nexus_ai = Permission(
        name="use:nexus_ai",
        description="Use NexusAI"
    )
    
    manage_nexus_ai = Permission(
        name="manage:nexus_ai",
        description="Manage NexusAI settings"
    )
    
    db.add_all([
        view_dashboard, manage_users, manage_tenants,
        view_templates, manage_templates,
        view_deployments, manage_deployments,
        use_nexus_ai, manage_nexus_ai
    ])
    db.flush()
    
    # Create default roles
    admin_role = Role(
        name="admin",
        description="Administrator role"
    )
    
    user_role = Role(
        name="user",
        description="Regular user role"
    )
    
    msp_role = Role(
        name="msp",
        description="Managed Service Provider role"
    )
    
    db.add_all([admin_role, user_role, msp_role])
    db.flush()
    
    # Assign permissions to roles
    admin_role.permissions = [
        view_dashboard, manage_users, manage_tenants,
        view_templates, manage_templates,
        view_deployments, manage_deployments,
        use_nexus_ai, manage_nexus_ai
    ]
    
    user_role.permissions = [
        view_dashboard,
        view_templates,
        view_deployments,
        use_nexus_ai
    ]
    
    msp_role.permissions = [
        view_dashboard,
        view_templates, manage_templates,
        view_deployments, manage_deployments,
        use_nexus_ai
    ]
    
    db.flush()
    
    # Create default users
    admin_user = User(
        user_id="admin",
        name="Admin User",
        email="admin@example.com",
        hashed_password="$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW",  # "password"
        role_id=admin_role.id,
        tenant_id=default_tenant.id
    )
    
    regular_user = User(
        user_id="user",
        name="Regular User",
        email="user@example.com",
        hashed_password="$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW",  # "password"
        role_id=user_role.id,
        tenant_id=acme_tenant.id
    )
    
    msp_user = User(
        user_id="msp",
        name="MSP User",
        email="msp@example.com",
        hashed_password="$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW",  # "password"
        role_id=msp_role.id,
        tenant_id=default_tenant.id
    )
    
    db.add_all([admin_user, regular_user, msp_user])
    db.commit()


if __name__ == "__main__":
    from app.db.session import SessionLocal
    
    db = SessionLocal()
    init_db(db)
    db.close()


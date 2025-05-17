from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.db.session import Base, engine
from app.models.user import User, Role, Permission, Tenant, RolePermission, UserPermission


def init_db(db: Session) -> None:
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Check if database is already initialized
    if db.query(User).first():
        return
    
    # Create roles
    user_role = Role(name="user", description="Regular user with limited access")
    admin_role = Role(name="admin", description="Administrator with tenant-level access")
    msp_role = Role(name="msp", description="Managed Service Provider with multi-tenant access")
    
    db.add(user_role)
    db.add(admin_role)
    db.add(msp_role)
    db.commit()
    
    # Create permissions
    permissions = [
        Permission(name="view:dashboard", description="View dashboard"),
        Permission(name="view:catalog", description="View template catalog"),
        Permission(name="deploy:template", description="Deploy templates"),
        Permission(name="view:deployments", description="View deployments"),
        Permission(name="manage:deployments", description="Manage deployments"),
        Permission(name="view:templates", description="View templates"),
        Permission(name="manage:templates", description="Manage templates"),
        Permission(name="view:environments", description="View environments"),
        Permission(name="manage:environments", description="Manage environments"),
        Permission(name="view:cloud-accounts", description="View cloud accounts"),
        Permission(name="manage:cloud-accounts", description="Manage cloud accounts"),
        Permission(name="view:users", description="View users and groups"),
        Permission(name="manage:users", description="Manage users and groups"),
        Permission(name="view:settings", description="View settings"),
        Permission(name="manage:settings", description="Manage settings"),
        Permission(name="view:tenants", description="View tenants"),
        Permission(name="manage:tenants", description="Manage tenants"),
        Permission(name="use:nexus-ai", description="Use NexusAI"),
    ]
    
    for permission in permissions:
        db.add(permission)
    
    db.commit()
    
    # Assign permissions to roles
    # User role permissions
    user_permissions = [
        "view:dashboard", 
        "view:catalog", 
        "deploy:template", 
        "view:deployments", 
        "view:templates",
        "view:environments",
        "view:cloud-accounts",
        "view:settings",
        "use:nexus-ai"
    ]
    
    for perm_name in user_permissions:
        permission = db.query(Permission).filter(Permission.name == perm_name).first()
        if permission:
            db.add(RolePermission(role_id=user_role.id, permission_id=permission.id))
    
    # Admin role permissions
    admin_permissions = [
        "view:dashboard", 
        "view:catalog", 
        "deploy:template", 
        "view:deployments", 
        "manage:deployments",
        "view:templates",
        "manage:templates",
        "view:environments",
        "manage:environments",
        "view:cloud-accounts",
        "manage:cloud-accounts",
        "view:users",
        "manage:users",
        "view:settings",
        "manage:settings",
        "use:nexus-ai"
    ]
    
    for perm_name in admin_permissions:
        permission = db.query(Permission).filter(Permission.name == perm_name).first()
        if permission:
            db.add(RolePermission(role_id=admin_role.id, permission_id=permission.id))
    
    # MSP role permissions (all permissions)
    for permission in permissions:
        db.add(RolePermission(role_id=msp_role.id, permission_id=permission.id))
    
    db.commit()
    
    # Create tenants
    tenant1 = Tenant(
        tenant_id="tenant-1",
        name="Acme Corp",
        description="Main corporate tenant"
    )
    
    tenant2 = Tenant(
        tenant_id="tenant-2",
        name="Dev Team",
        description="Development team workspace"
    )
    
    db.add(tenant1)
    db.add(tenant2)
    db.commit()
    
    # Create users
    admin_user = User(
        user_id="user-1",
        name="Admin User",
        email="admin@example.com",
        password_hash=get_password_hash("password"),
        role_id=admin_role.id,
        tenant_id=tenant1.id
    )
    
    regular_user = User(
        user_id="user-2",
        name="Regular User",
        email="user@example.com",
        password_hash=get_password_hash("password"),
        role_id=user_role.id,
        tenant_id=tenant1.id
    )
    
    msp_user = User(
        user_id="user-3",
        name="MSP User",
        email="msp@example.com",
        password_hash=get_password_hash("password"),
        role_id=msp_role.id,
        tenant_id=tenant2.id
    )
    
    db.add(admin_user)
    db.add(regular_user)
    db.add(msp_user)
    db.commit()


if __name__ == "__main__":
    from app.db.session import SessionLocal
    
    db = SessionLocal()
    init_db(db)
    db.close()


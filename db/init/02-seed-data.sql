-- Insert initial data for the application

-- Insert roles
INSERT INTO roles (name, description) VALUES
    ('user', 'Regular user with limited access'),
    ('admin', 'Administrator with tenant-level access'),
    ('msp', 'Managed Service Provider with multi-tenant access');

-- Insert permissions
INSERT INTO permissions (name, description) VALUES
    ('view:dashboard', 'View dashboard'),
    ('view:catalog', 'View template catalog'),
    ('deploy:template', 'Deploy templates'),
    ('view:deployments', 'View deployments'),
    ('manage:deployments', 'Manage deployments'),
    ('view:templates', 'View templates'),
    ('manage:templates', 'Manage templates'),
    ('view:environments', 'View environments'),
    ('manage:environments', 'Manage environments'),
    ('view:cloud-accounts', 'View cloud accounts'),
    ('manage:cloud-accounts', 'Manage cloud accounts'),
    ('view:users', 'View users and groups'),
    ('manage:users', 'Manage users and groups'),
    ('view:settings', 'View settings'),
    ('manage:settings', 'Manage settings'),
    ('view:tenants', 'View tenants'),
    ('manage:tenants', 'Manage tenants'),
    ('use:nexus-ai', 'Use NexusAI');

-- Assign permissions to roles
-- User role permissions
INSERT INTO role_permissions (role_id, permission_id) 
SELECT 
    (SELECT id FROM roles WHERE name = 'user'),
    id 
FROM permissions 
WHERE name IN (
    'view:dashboard', 
    'view:catalog', 
    'deploy:template', 
    'view:deployments', 
    'view:templates',
    'view:environments',
    'view:cloud-accounts',
    'view:settings',
    'use:nexus-ai'
);

-- Admin role permissions
INSERT INTO role_permissions (role_id, permission_id) 
SELECT 
    (SELECT id FROM roles WHERE name = 'admin'),
    id 
FROM permissions 
WHERE name IN (
    'view:dashboard', 
    'view:catalog', 
    'deploy:template', 
    'view:deployments', 
    'manage:deployments',
    'view:templates',
    'manage:templates',
    'view:environments',
    'manage:environments',
    'view:cloud-accounts',
    'manage:cloud-accounts',
    'view:users',
    'manage:users',
    'view:settings',
    'manage:settings',
    'use:nexus-ai'
);

-- MSP role permissions (all permissions)
INSERT INTO role_permissions (role_id, permission_id) 
SELECT 
    (SELECT id FROM roles WHERE name = 'msp'),
    id 
FROM permissions;

-- Insert tenants
INSERT INTO tenants (tenant_id, name, description, created_at) VALUES
    ('tenant-1', 'Acme Corp', 'Main corporate tenant', '2023-01-15T12:00:00Z'),
    ('tenant-2', 'Dev Team', 'Development team workspace', '2023-02-20T09:30:00Z');

-- Insert users with bcrypt hashed passwords (password is 'password' for all users)
INSERT INTO users (user_id, name, email, password_hash, role_id, tenant_id) VALUES
    (
        'user-1', 
        'Admin User', 
        'admin@example.com', 
        '$2a$10$JmRvZnCBkzAYI8F2XQqQle1F5h0JI/Ixw0YvdYT.2JbJ6.tAWzUHi', -- 'password'
        (SELECT id FROM roles WHERE name = 'admin'),
        (SELECT id FROM tenants WHERE tenant_id = 'tenant-1')
    ),
    (
        'user-2', 
        'Regular User', 
        'user@example.com', 
        '$2a$10$JmRvZnCBkzAYI8F2XQqQle1F5h0JI/Ixw0YvdYT.2JbJ6.tAWzUHi', -- 'password'
        (SELECT id FROM roles WHERE name = 'user'),
        (SELECT id FROM tenants WHERE tenant_id = 'tenant-1')
    ),
    (
        'user-3', 
        'MSP User', 
        'msp@example.com', 
        '$2a$10$JmRvZnCBkzAYI8F2XQqQle1F5h0JI/Ixw0YvdYT.2JbJ6.tAWzUHi', -- 'password'
        (SELECT id FROM roles WHERE name = 'msp'),
        (SELECT id FROM tenants WHERE tenant_id = 'tenant-2')
    );


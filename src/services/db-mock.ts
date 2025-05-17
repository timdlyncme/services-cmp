import { User, Tenant, UserRole, Permission } from "@/types/auth";

// Mock data for demo purposes
const mockTenants: Tenant[] = [
  {
    id: "tenant-1",
    name: "Acme Corp",
    description: "Main corporate tenant",
    createdAt: "2023-01-15T12:00:00Z",
  },
  {
    id: "tenant-2",
    name: "Dev Team",
    description: "Development team workspace",
    createdAt: "2023-02-20T09:30:00Z",
  },
];

const mockUsers = [
  {
    id: "user-1",
    userId: "user-1",
    name: "Admin User",
    email: "admin@example.com",
    passwordHash: "$2a$10$JmRvZnCBkzAYI8F2XQqQle1F5h0JI/Ixw0YvdYT.2JbJ6.tAWzUHi", // 'password'
    role: "admin" as UserRole,
    tenantId: "tenant-1",
  },
  {
    id: "user-2",
    userId: "user-2",
    name: "Regular User",
    email: "user@example.com",
    passwordHash: "$2a$10$JmRvZnCBkzAYI8F2XQqQle1F5h0JI/Ixw0YvdYT.2JbJ6.tAWzUHi", // 'password'
    role: "user" as UserRole,
    tenantId: "tenant-1",
  },
  {
    id: "user-3",
    userId: "user-3",
    name: "MSP User",
    email: "msp@example.com",
    passwordHash: "$2a$10$JmRvZnCBkzAYI8F2XQqQle1F5h0JI/Ixw0YvdYT.2JbJ6.tAWzUHi", // 'password'
    role: "msp" as UserRole,
    tenantId: "tenant-2",
  },
];

// Mock permissions
const mockPermissions: Record<UserRole, Permission[]> = {
  user: [
    { name: "view:dashboard", description: "View dashboard" },
    { name: "view:catalog", description: "View template catalog" },
    { name: "deploy:template", description: "Deploy templates" },
    { name: "view:deployments", description: "View deployments" },
    { name: "view:templates", description: "View templates" },
    { name: "view:environments", description: "View environments" },
    { name: "view:cloud-accounts", description: "View cloud accounts" },
    { name: "view:settings", description: "View settings" },
    { name: "use:nexus-ai", description: "Use NexusAI" },
  ],
  admin: [
    { name: "view:dashboard", description: "View dashboard" },
    { name: "view:catalog", description: "View template catalog" },
    { name: "deploy:template", description: "Deploy templates" },
    { name: "view:deployments", description: "View deployments" },
    { name: "manage:deployments", description: "Manage deployments" },
    { name: "view:templates", description: "View templates" },
    { name: "manage:templates", description: "Manage templates" },
    { name: "view:environments", description: "View environments" },
    { name: "manage:environments", description: "Manage environments" },
    { name: "view:cloud-accounts", description: "View cloud accounts" },
    { name: "manage:cloud-accounts", description: "Manage cloud accounts" },
    { name: "view:users", description: "View users and groups" },
    { name: "manage:users", description: "Manage users and groups" },
    { name: "view:settings", description: "View settings" },
    { name: "manage:settings", description: "Manage settings" },
    { name: "use:nexus-ai", description: "Use NexusAI" },
  ],
  msp: [
    { name: "view:dashboard", description: "View dashboard" },
    { name: "view:catalog", description: "View template catalog" },
    { name: "deploy:template", description: "Deploy templates" },
    { name: "view:deployments", description: "View deployments" },
    { name: "manage:deployments", description: "Manage deployments" },
    { name: "view:templates", description: "View templates" },
    { name: "manage:templates", description: "Manage templates" },
    { name: "view:environments", description: "View environments" },
    { name: "manage:environments", description: "Manage environments" },
    { name: "view:cloud-accounts", description: "View cloud accounts" },
    { name: "manage:cloud-accounts", description: "Manage cloud accounts" },
    { name: "view:users", description: "View users and groups" },
    { name: "manage:users", description: "Manage users and groups" },
    { name: "view:settings", description: "View settings" },
    { name: "manage:settings", description: "Manage settings" },
    { name: "view:tenants", description: "View tenants" },
    { name: "manage:tenants", description: "Manage tenants" },
    { name: "use:nexus-ai", description: "Use NexusAI" },
  ],
};

// Mock database query function
export const query = async (queryText: string, params: any[] = []) => {
  console.log("Mock DB Query:", queryText, params);
  
  // Mock user authentication
  if (queryText.includes("SELECT") && queryText.includes("FROM users") && queryText.includes("WHERE u.email = $1")) {
    const email = params[0];
    const user = mockUsers.find(u => u.email === email);
    
    if (!user) {
      return { rows: [] };
    }
    
    const tenant = mockTenants.find(t => t.id === user.tenantId);
    
    return {
      rows: [{
        id: user.id,
        user_id: user.userId,
        name: user.name,
        email: user.email,
        password_hash: user.passwordHash,
        role: user.role,
        tenant_id: user.tenantId,
        tenant_name: tenant?.name
      }]
    };
  }
  
  // Mock permissions query
  if (queryText.includes("SELECT DISTINCT p.name, p.description") && queryText.includes("FROM permissions p")) {
    const email = params[0];
    const user = mockUsers.find(u => u.email === email);
    
    if (!user) {
      return { rows: [] };
    }
    
    return {
      rows: mockPermissions[user.role].map(p => ({
        name: p.name,
        description: p.description
      }))
    };
  }
  
  // Mock user verification by userId
  if (queryText.includes("SELECT u.id, u.user_id, u.name, u.email") && queryText.includes("WHERE u.user_id = $1")) {
    const userId = params[0];
    const user = mockUsers.find(u => u.userId === userId);
    
    if (!user) {
      return { rows: [] };
    }
    
    const tenant = mockTenants.find(t => t.id === user.tenantId);
    
    return {
      rows: [{
        id: user.id,
        user_id: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        tenant_id: user.tenantId,
        tenant_name: tenant?.name
      }]
    };
  }
  
  // Mock tenants query
  if (queryText.includes("SELECT t.id, t.tenant_id, t.name, t.description, t.created_at") && queryText.includes("FROM tenants t")) {
    const userId = params[0];
    const user = mockUsers.find(u => u.userId === userId);
    
    if (!user) {
      return { rows: [] };
    }
    
    // For MSP users, return all tenants; for others, return only their tenant
    const tenants = user.role === 'msp' 
      ? mockTenants 
      : mockTenants.filter(t => t.id === user.tenantId);
    
    return {
      rows: tenants.map(t => ({
        id: t.id,
        tenant_id: t.id,
        name: t.name,
        description: t.description,
        created_at: t.createdAt
      }))
    };
  }
  
  // Mock permission check
  if (queryText.includes("SELECT COUNT(*) as count") && queryText.includes("FROM permissions p")) {
    const permissionName = params[0];
    const userId = params[1];
    const user = mockUsers.find(u => u.userId === userId);
    
    if (!user) {
      return { rows: [{ count: 0 }] };
    }
    
    const hasPermission = mockPermissions[user.role].some(p => p.name === permissionName);
    
    return {
      rows: [{ count: hasPermission ? 1 : 0 }]
    };
  }
  
  // Default empty response
  return { rows: [] };
};

export default { query };


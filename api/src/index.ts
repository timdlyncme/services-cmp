import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create database connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'cmpuser',
  password: process.env.DB_PASSWORD || 'cmppassword',
  database: process.env.DB_NAME || 'cmpdb',
});

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware to verify JWT token
const authenticateToken = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    
    req.user = user;
    next();
  });
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find user by email
    const userResult = await pool.query(
      'SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.email = $1',
      [username]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ detail: 'Invalid email or password' });
    }
    
    const user = userResult.rows[0];
    
    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!passwordMatch) {
      return res.status(401).json({ detail: 'Invalid email or password' });
    }
    
    // Get user permissions
    const permissionsResult = await pool.query(
      `SELECT p.name, p.description 
       FROM permissions p 
       JOIN role_permissions rp ON p.id = rp.permission_id 
       WHERE rp.role_id = $1`,
      [user.role_id]
    );
    
    const permissions = permissionsResult.rows.map(row => ({
      name: row.name,
      description: row.description
    }));
    
    // Get user's tenant
    const tenantResult = await pool.query(
      'SELECT tenant_id, name, description, created_at FROM tenants WHERE id = $1',
      [user.tenant_id]
    );
    
    const tenant = tenantResult.rows[0];
    
    // Create JWT token
    const token = jwt.sign(
      { 
        id: user.user_id,
        email: user.email,
        role: user.role_name,
        tenantId: tenant.tenant_id
      }, 
      JWT_SECRET, 
      { expiresIn: '24h' }
    );
    
    // Return user data and token
    res.json({
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role_name,
        tenantId: tenant.tenant_id,
        permissions
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Verify token endpoint
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({ valid: true });
});

// Get current user endpoint
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const { id } = req.user;
    
    // Get user data
    const userResult = await pool.query(
      'SELECT u.*, r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.user_id = $1',
      [id]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ detail: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Get user permissions
    const permissionsResult = await pool.query(
      `SELECT p.name, p.description 
       FROM permissions p 
       JOIN role_permissions rp ON p.id = rp.permission_id 
       WHERE rp.role_id = $1`,
      [user.role_id]
    );
    
    const permissions = permissionsResult.rows.map(row => ({
      name: row.name,
      description: row.description
    }));
    
    // Get user's tenant
    const tenantResult = await pool.query(
      'SELECT tenant_id, name, description, created_at FROM tenants WHERE id = $1',
      [user.tenant_id]
    );
    
    const tenant = tenantResult.rows[0];
    
    // Return user data
    res.json({
      id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role_name,
      tenantId: tenant.tenant_id,
      permissions
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Check permission endpoint
app.get('/api/auth/permission/:name', authenticateToken, async (req, res) => {
  try {
    const { id } = req.user;
    const { name } = req.params;
    
    // Get user's role
    const userResult = await pool.query(
      'SELECT role_id FROM users WHERE user_id = $1',
      [id]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ detail: 'User not found' });
    }
    
    const { role_id } = userResult.rows[0];
    
    // Check if user has the permission
    const permissionResult = await pool.query(
      `SELECT 1 
       FROM role_permissions rp 
       JOIN permissions p ON rp.permission_id = p.id 
       WHERE rp.role_id = $1 AND p.name = $2`,
      [role_id, name]
    );
    
    const hasPermission = permissionResult.rows.length > 0;
    
    res.json({ hasPermission });
  } catch (error) {
    console.error('Check permission error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Get user's tenants endpoint
app.get('/api/tenants', authenticateToken, async (req, res) => {
  try {
    const { id, role } = req.user;
    
    let tenants = [];
    
    if (role === 'msp') {
      // MSP users can see all tenants
      const tenantsResult = await pool.query(
        'SELECT tenant_id as id, name, description, created_at as "createdAt" FROM tenants'
      );
      
      tenants = tenantsResult.rows;
    } else {
      // Regular users can only see their own tenant
      const userResult = await pool.query(
        'SELECT tenant_id FROM users WHERE user_id = $1',
        [id]
      );
      
      if (userResult.rows.length > 0) {
        const { tenant_id } = userResult.rows[0];
        
        const tenantResult = await pool.query(
          'SELECT tenant_id as id, name, description, created_at as "createdAt" FROM tenants WHERE id = $1',
          [tenant_id]
        );
        
        tenants = tenantResult.rows;
      }
    }
    
    res.json(tenants);
  } catch (error) {
    console.error('Get tenants error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Get cloud accounts endpoint
app.get('/api/cloud-accounts', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.query;
    
    // For now, return mock data
    const mockCloudAccounts = [
      {
        id: "account-1",
        name: "Production Azure",
        provider: "azure",
        status: "connected",
        tenantId: "tenant-1",
      },
      {
        id: "account-2",
        name: "Development AWS",
        provider: "aws",
        status: "connected",
        tenantId: "tenant-1",
      },
      {
        id: "account-3",
        name: "GCP Research",
        provider: "gcp",
        status: "warning",
        tenantId: "tenant-1",
      },
      {
        id: "account-4",
        name: "Dev Team Azure",
        provider: "azure",
        status: "connected",
        tenantId: "tenant-2",
      },
    ];
    
    const filteredAccounts = tenant_id 
      ? mockCloudAccounts.filter(account => account.tenantId === tenant_id)
      : mockCloudAccounts;
    
    res.json(filteredAccounts);
  } catch (error) {
    console.error('Get cloud accounts error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Get deployments endpoint
app.get('/api/deployments', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.query;
    
    // For now, return mock data
    const mockDeployments = [
      {
        id: "deployment-1",
        name: "Production Web App",
        templateId: "template-1",
        templateName: "Basic Web Application",
        provider: "azure",
        status: "running",
        environment: "production",
        createdAt: "2023-05-10T08:30:00Z",
        updatedAt: "2023-05-10T09:15:00Z",
        parameters: {
          location: "eastus",
          appServicePlanTier: "Basic",
          appServicePlanSize: "B1"
        },
        resources: [
          "Resource Group: web-app-resources",
          "App Service Plan: webapp-asp",
          "App Service: webapp-basic-service"
        ],
        tenantId: "tenant-1"
      },
      {
        id: "deployment-2",
        name: "Dev Microservices",
        templateId: "template-2",
        templateName: "Containerized Microservices",
        provider: "aws",
        status: "running",
        environment: "development",
        createdAt: "2023-05-15T11:20:00Z",
        updatedAt: "2023-05-15T12:45:00Z",
        parameters: {
          region: "us-west-2",
          clusterName: "microservices-dev"
        },
        resources: [
          "EKS Cluster: microservices-dev",
          "IAM Role: eks-cluster-role",
          "VPC: vpc-12345"
        ],
        tenantId: "tenant-1"
      },
      {
        id: "deployment-3",
        name: "Marketing Website",
        templateId: "template-3",
        templateName: "Google Cloud Storage with CDN",
        provider: "gcp",
        status: "running",
        environment: "production",
        createdAt: "2023-06-01T09:00:00Z",
        updatedAt: "2023-06-01T09:45:00Z",
        parameters: {
          bucketName: "marketing-website",
          region: "us-central1"
        },
        resources: [
          "Storage Bucket: marketing-website",
          "Backend Bucket: cdn-backend-bucket",
          "IAM Binding: allUsers:objectViewer"
        ],
        tenantId: "tenant-1"
      },
      {
        id: "deployment-4",
        name: "API Backend VMs",
        templateId: "template-4",
        templateName: "Virtual Machine Scale Set",
        provider: "azure",
        status: "failed",
        environment: "staging",
        createdAt: "2023-06-10T14:10:00Z",
        updatedAt: "2023-06-10T14:55:00Z",
        parameters: {
          vmSku: "Standard_DS2_v2",
          vmssName: "api-vmss",
          capacity: "3"
        },
        resources: [
          "VM Scale Set: api-vmss (Failed)"
        ],
        tenantId: "tenant-1"
      },
      {
        id: "deployment-5",
        name: "Documentation Site",
        templateId: "template-5",
        templateName: "S3 Static Website",
        provider: "aws",
        status: "pending",
        environment: "production",
        createdAt: "2023-06-15T10:30:00Z",
        updatedAt: "2023-06-15T10:40:00Z",
        parameters: {
          bucketName: "docs-website"
        },
        resources: [
          "S3 Bucket: Pending...",
          "Bucket Policy: Pending..."
        ],
        tenantId: "tenant-1"
      },
      {
        id: "deployment-6",
        name: "Analytics Database",
        templateId: "template-6",
        templateName: "Cloud SQL Database",
        provider: "gcp",
        status: "stopped",
        environment: "development",
        createdAt: "2023-05-25T13:45:00Z",
        updatedAt: "2023-06-14T09:20:00Z",
        parameters: {
          instanceName: "analytics-db",
          databaseName: "analytics",
          tier: "db-f1-micro"
        },
        resources: [
          "SQL Instance: analytics-db",
          "Database: analytics",
          "User: my-user"
        ],
        tenantId: "tenant-2"
      }
    ];
    
    const filteredDeployments = tenant_id 
      ? mockDeployments.filter(deployment => deployment.tenantId === tenant_id)
      : mockDeployments;
    
    res.json(filteredDeployments);
  } catch (error) {
    console.error('Get deployments error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Get deployment by ID endpoint
app.get('/api/deployments/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // For now, return mock data
    const mockDeployments = [
      {
        id: "deployment-1",
        name: "Production Web App",
        templateId: "template-1",
        templateName: "Basic Web Application",
        provider: "azure",
        status: "running",
        environment: "production",
        createdAt: "2023-05-10T08:30:00Z",
        updatedAt: "2023-05-10T09:15:00Z",
        parameters: {
          location: "eastus",
          appServicePlanTier: "Basic",
          appServicePlanSize: "B1"
        },
        resources: [
          "Resource Group: web-app-resources",
          "App Service Plan: webapp-asp",
          "App Service: webapp-basic-service"
        ],
        tenantId: "tenant-1"
      },
      {
        id: "deployment-2",
        name: "Dev Microservices",
        templateId: "template-2",
        templateName: "Containerized Microservices",
        provider: "aws",
        status: "running",
        environment: "development",
        createdAt: "2023-05-15T11:20:00Z",
        updatedAt: "2023-05-15T12:45:00Z",
        parameters: {
          region: "us-west-2",
          clusterName: "microservices-dev"
        },
        resources: [
          "EKS Cluster: microservices-dev",
          "IAM Role: eks-cluster-role",
          "VPC: vpc-12345"
        ],
        tenantId: "tenant-1"
      }
    ];
    
    const deployment = mockDeployments.find(d => d.id === id);
    
    if (!deployment) {
      return res.status(404).json({ detail: 'Deployment not found' });
    }
    
    res.json(deployment);
  } catch (error) {
    console.error('Get deployment error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Get templates endpoint
app.get('/api/templates', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.query;
    
    // For now, return mock data
    const mockTemplates = [
      {
        id: "template-1",
        name: "Basic Web Application",
        description: "Deploys a simple web application with supporting infrastructure",
        type: "terraform",
        provider: "azure",
        deploymentCount: 5,
        uploadedAt: "2023-03-15T09:12:00Z",
        updatedAt: "2023-05-22T13:45:00Z",
        categories: ["web", "basic"],
        tenantId: "tenant-1",
      },
      {
        id: "template-2",
        name: "Containerized Microservices",
        description: "Kubernetes cluster for microservices deployment",
        type: "terraform",
        provider: "aws",
        deploymentCount: 3,
        uploadedAt: "2023-04-02T11:30:00Z",
        updatedAt: "2023-06-10T09:15:00Z",
        categories: ["kubernetes", "microservices", "containers"],
        tenantId: "tenant-1",
      },
      {
        id: "template-3",
        name: "Google Cloud Storage with CDN",
        description: "Static website hosting with CDN",
        type: "terraform",
        provider: "gcp",
        deploymentCount: 2,
        uploadedAt: "2023-05-05T14:20:00Z",
        updatedAt: "2023-06-18T16:40:00Z",
        categories: ["storage", "cdn", "static-site"],
        tenantId: "tenant-1",
      },
      {
        id: "template-4",
        name: "Virtual Machine Scale Set",
        description: "Autoscaling VMs for high availability",
        type: "arm",
        provider: "azure",
        deploymentCount: 1,
        uploadedAt: "2023-02-20T10:05:00Z",
        updatedAt: "2023-05-30T11:22:00Z",
        categories: ["virtual-machines", "autoscaling", "high-availability"],
        tenantId: "tenant-1",
      },
      {
        id: "template-5",
        name: "S3 Static Website",
        description: "Simple S3 bucket configured for website hosting",
        type: "cloudformation",
        provider: "aws",
        deploymentCount: 8,
        uploadedAt: "2023-01-10T08:45:00Z",
        updatedAt: "2023-05-15T15:30:00Z",
        categories: ["storage", "static-site", "web"],
        tenantId: "tenant-1",
      },
      {
        id: "template-6",
        name: "Cloud SQL Database",
        description: "Managed PostgreSQL database on GCP",
        type: "terraform",
        provider: "gcp",
        deploymentCount: 3,
        uploadedAt: "2023-03-25T13:10:00Z",
        updatedAt: "2023-06-05T10:35:00Z",
        categories: ["database", "postgresql"],
        tenantId: "tenant-2",
      }
    ];
    
    const filteredTemplates = tenant_id 
      ? mockTemplates.filter(template => template.tenantId === tenant_id)
      : mockTemplates;
    
    res.json(filteredTemplates);
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Get environments endpoint
app.get('/api/environments', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.query;
    
    // For now, return mock data
    const mockEnvironments = [
      { id: 'env-1', name: 'Development', tenantId: 'tenant-1' },
      { id: 'env-2', name: 'Staging', tenantId: 'tenant-1' },
      { id: 'env-3', name: 'Production', tenantId: 'tenant-1' },
      { id: 'env-4', name: 'Development', tenantId: 'tenant-2' },
      { id: 'env-5', name: 'Production', tenantId: 'tenant-2' }
    ];
    
    const filteredEnvironments = tenant_id 
      ? mockEnvironments.filter(env => env.tenantId === tenant_id)
      : mockEnvironments;
    
    res.json(filteredEnvironments);
  } catch (error) {
    console.error('Get environments error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Get users endpoint
app.get('/api/users', authenticateToken, async (req, res) => {
  try {
    const { tenant_id } = req.query;
    
    // For now, return mock data
    const mockUsers = [
      { id: 'user-1', name: 'Admin User', email: 'admin@example.com', role: 'admin', tenantId: 'tenant-1' },
      { id: 'user-2', name: 'Regular User', email: 'user@example.com', role: 'user', tenantId: 'tenant-1' },
      { id: 'user-3', name: 'MSP User', email: 'msp@example.com', role: 'msp', tenantId: 'tenant-2' }
    ];
    
    const filteredUsers = tenant_id 
      ? mockUsers.filter(user => user.tenantId === tenant_id)
      : mockUsers;
    
    res.json(filteredUsers);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ detail: 'Internal server error' });
  }
});

// Add type definition for Express Request
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Start server
const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;


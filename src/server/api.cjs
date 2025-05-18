// Simple Express API for authentication
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');
require('dotenv').config();

const app = express();
const port = process.env.API_PORT || 8000; // Changed to 8000 to match the client's expected port

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'cmpuser',
  password: process.env.DB_PASSWORD || 'cmppassword',
  database: process.env.DB_NAME || 'cmpdb',
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err.stack);
  } else {
    console.log('Database connected successfully:', res.rows[0]);
  }
});

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production';

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Forbidden', details: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Login route
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('Login request received:', req.body);
    const { email, password } = req.body;
    
    // Find user by email
    const userResult = await pool.query(
      `SELECT u.id, u.user_id, u.name, u.email, u.password_hash, r.name as role, t.tenant_id, t.name as tenant_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       JOIN tenants t ON u.tenant_id = t.id
       WHERE u.email = $1`,
      [email]
    );
    
    if (userResult.rows.length === 0) {
      console.log('User not found:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = userResult.rows[0];
    console.log('User found:', user.email);
    
    // Verify password
    // For development, also accept 'password' for all users
    const isPasswordValid = password === 'password' || await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
      console.log('Invalid password for user:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Get user permissions
    const permissionsResult = await pool.query(
      `SELECT DISTINCT p.name, p.description
       FROM permissions p
       LEFT JOIN role_permissions rp ON p.id = rp.permission_id
       LEFT JOIN user_permissions up ON p.id = up.permission_id
       WHERE rp.role_id = (SELECT role_id FROM users WHERE email = $1)
       OR up.user_id = (SELECT id FROM users WHERE email = $1)`,
      [email]
    );
    
    const permissions = permissionsResult.rows.map(row => ({
      name: row.name,
      description: row.description
    }));
    
    // Create JWT token
    const token = jwt.sign(
      { 
        userId: user.user_id, 
        email: user.email, 
        role: user.role,
        tenantId: user.tenant_id
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log('Login successful for user:', email);
    
    // Return user data and token
    res.json({
      user: {
        id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: user.tenant_id,
        permissions
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Verify token route
app.get('/api/auth/verify', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    console.log('Token verification request for user ID:', userId);
    
    // Get user data
    const userResult = await pool.query(
      `SELECT u.id, u.user_id, u.name, u.email, r.name as role, t.tenant_id, t.name as tenant_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       JOIN tenants t ON u.tenant_id = t.id
       WHERE u.user_id = $1`,
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      console.log('User not found during token verification:', userId);
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Get user permissions
    const permissionsResult = await pool.query(
      `SELECT DISTINCT p.name, p.description
       FROM permissions p
       LEFT JOIN role_permissions rp ON p.id = rp.permission_id
       LEFT JOIN user_permissions up ON p.id = up.permission_id
       WHERE rp.role_id = (SELECT role_id FROM users WHERE user_id = $1)
       OR up.user_id = (SELECT id FROM users WHERE user_id = $1)`,
      [userId]
    );
    
    const permissions = permissionsResult.rows.map(row => ({
      name: row.name,
      description: row.description
    }));
    
    console.log('Token verification successful for user ID:', userId);
    
    // Return user data
    res.json({
      id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id,
      permissions
    });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get user data
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    console.log('Get user data request for user ID:', userId);
    
    // Get user data
    const userResult = await pool.query(
      `SELECT u.id, u.user_id, u.name, u.email, r.name as role, t.tenant_id, t.name as tenant_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       JOIN tenants t ON u.tenant_id = t.id
       WHERE u.user_id = $1`,
      [userId]
    );
    
    if (userResult.rows.length === 0) {
      console.log('User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userResult.rows[0];
    
    // Get user permissions
    const permissionsResult = await pool.query(
      `SELECT DISTINCT p.name, p.description
       FROM permissions p
       LEFT JOIN role_permissions rp ON p.id = rp.permission_id
       LEFT JOIN user_permissions up ON p.id = up.permission_id
       WHERE rp.role_id = (SELECT role_id FROM users WHERE user_id = $1)
       OR up.user_id = (SELECT id FROM users WHERE user_id = $1)`,
      [userId]
    );
    
    const permissions = permissionsResult.rows.map(row => ({
      name: row.name,
      description: row.description
    }));
    
    console.log('User data retrieved successfully for user ID:', userId);
    
    // Return user data
    res.json({
      id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenantId: user.tenant_id,
      permissions
    });
  } catch (error) {
    console.error('Get user data error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get user tenants
app.get('/api/auth/tenants', authenticateToken, async (req, res) => {
  try {
    const { userId, role } = req.user;
    console.log('Get tenants request for user ID:', userId, 'with role:', role);
    
    let tenantsResult;
    
    // For MSP users, return all tenants
    // For admin and regular users, return only their tenant
    if (role === 'msp') {
      tenantsResult = await pool.query(
        `SELECT t.id, t.tenant_id, t.name, t.description, t.created_at
         FROM tenants t
         ORDER BY t.name`
      );
    } else {
      tenantsResult = await pool.query(
        `SELECT t.id, t.tenant_id, t.name, t.description, t.created_at
         FROM tenants t
         JOIN users u ON t.id = u.tenant_id
         WHERE u.user_id = $1
         ORDER BY t.name`,
        [userId]
      );
    }
    
    const tenants = tenantsResult.rows.map(row => ({
      id: row.tenant_id,
      name: row.name,
      description: row.description,
      createdAt: row.created_at
    }));
    
    console.log('Tenants retrieved successfully for user ID:', userId, 'Count:', tenants.length);
    res.json(tenants);
  } catch (error) {
    console.error('Get user tenants error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Check permission
app.get('/api/auth/permission/:name', authenticateToken, async (req, res) => {
  try {
    const { userId, role } = req.user;
    const { name } = req.params;
    console.log(`Permission check for user ID: ${userId}, role: ${role}, permission: ${name}`);
    
    // Admin and MSP roles have all permissions
    if (role === 'admin' || role === 'msp') {
      console.log(`User ${userId} has role ${role}, automatically granting permission: ${name}`);
      return res.json({ hasPermission: true });
    }
    
    // For regular users, check specific permission
    const result = await pool.query(
      `SELECT COUNT(*) as count
       FROM permissions p
       LEFT JOIN role_permissions rp ON p.id = rp.permission_id
       LEFT JOIN user_permissions up ON p.id = up.permission_id
       WHERE p.name = $1
       AND (
         rp.role_id = (SELECT role_id FROM users WHERE user_id = $2)
         OR up.user_id = (SELECT id FROM users WHERE user_id = $2)
       )`,
      [name, userId]
    );
    
    const hasPermission = parseInt(result.rows[0].count) > 0;
    console.log(`Permission check result for ${name}: ${hasPermission}`);
    
    res.json({ hasPermission });
  } catch (error) {
    console.error('Permission check error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get deployments
app.get('/api/deployments', authenticateToken, async (req, res) => {
  try {
    const { userId, role, tenantId: userTenantId } = req.user;
    const { tenantId } = req.query;
    console.log(`Get deployments request for user ID: ${userId}, role: ${role}, tenant ID: ${tenantId}`);
    
    // Check if user has access to the tenant
    let hasAccess = false;
    
    // MSP users have access to all tenants
    if (role === 'msp') {
      hasAccess = true;
    } 
    // Admin users have access to their own tenant
    else if (role === 'admin' && userTenantId === tenantId) {
      hasAccess = true;
    }
    // Regular users have access to their own tenant
    else if (userTenantId === tenantId) {
      hasAccess = true;
    }
    
    if (!hasAccess) {
      console.log(`User ${userId} does not have access to tenant ${tenantId}`);
      return res.status(403).json({ error: 'Forbidden', details: 'You do not have access to this tenant' });
    }
    
    // Get deployments from database
    // For now, we'll use mock data since the deployments table might not exist yet
    try {
      const mockData = require('./mock-data');
      
      // Filter deployments by tenant ID
      const deployments = mockData.mockDeployments.filter(d => d.tenantId === tenantId);
      
      console.log(`Deployments retrieved successfully for tenant ID: ${tenantId}, count: ${deployments.length}`);
      res.json(deployments);
    } catch (mockError) {
      console.error('Error loading mock deployments:', mockError);
      
      // Fallback to empty array
      res.json([]);
    }
  } catch (error) {
    console.error('Get deployments error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get cloud accounts
app.get('/api/cloud-accounts', authenticateToken, async (req, res) => {
  try {
    const { userId, role, tenantId: userTenantId } = req.user;
    const { tenantId } = req.query;
    console.log(`Get cloud accounts request for user ID: ${userId}, role: ${role}, tenant ID: ${tenantId}`);
    
    // Check if user has access to the tenant
    let hasAccess = false;
    
    // MSP users have access to all tenants
    if (role === 'msp') {
      hasAccess = true;
    } 
    // Admin users have access to their own tenant
    else if (role === 'admin' && userTenantId === tenantId) {
      hasAccess = true;
    }
    // Regular users have access to their own tenant
    else if (userTenantId === tenantId) {
      hasAccess = true;
    }
    
    if (!hasAccess) {
      console.log(`User ${userId} does not have access to tenant ${tenantId}`);
      return res.status(403).json({ error: 'Forbidden', details: 'You do not have access to this tenant' });
    }
    
    // Get cloud accounts from database
    // For now, we'll use mock data since the cloud_accounts table might not exist yet
    try {
      const mockData = require('./mock-data');
      
      // Filter cloud accounts by tenant ID
      const cloudAccounts = mockData.mockCloudAccounts.filter(ca => ca.tenantId === tenantId);
      
      console.log(`Cloud accounts retrieved successfully for tenant ID: ${tenantId}, count: ${cloudAccounts.length}`);
      res.json(cloudAccounts);
    } catch (mockError) {
      console.error('Error loading mock cloud accounts:', mockError);
      
      // Fallback to empty array
      res.json([]);
    }
  } catch (error) {
    console.error('Get cloud accounts error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get templates
app.get('/api/templates', authenticateToken, async (req, res) => {
  try {
    const { userId, role, tenantId: userTenantId } = req.user;
    const { tenantId } = req.query;
    console.log(`Get templates request for user ID: ${userId}, role: ${role}, tenant ID: ${tenantId}`);
    
    // Check if user has access to the tenant
    let hasAccess = false;
    
    // MSP users have access to all tenants
    if (role === 'msp') {
      hasAccess = true;
    } 
    // Admin users have access to their own tenant
    else if (role === 'admin' && userTenantId === tenantId) {
      hasAccess = true;
    }
    // Regular users have access to their own tenant
    else if (userTenantId === tenantId) {
      hasAccess = true;
    }
    
    if (!hasAccess) {
      console.log(`User ${userId} does not have access to tenant ${tenantId}`);
      return res.status(403).json({ error: 'Forbidden', details: 'You do not have access to this tenant' });
    }
    
    // Get templates from database
    // For now, we'll use mock data since the templates table might not exist yet
    try {
      const mockData = require('./mock-data');
      
      // Filter templates by tenant ID
      const templates = mockData.mockTemplates.filter(t => t.tenantId === tenantId);
      
      console.log(`Templates retrieved successfully for tenant ID: ${tenantId}, count: ${templates.length}`);
      res.json(templates);
    } catch (mockError) {
      console.error('Error loading mock templates:', mockError);
      
      // Fallback to empty array
      res.json([]);
    }
  } catch (error) {
    console.error('Get templates error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Get environments
app.get('/api/environments', authenticateToken, async (req, res) => {
  try {
    const { userId, role, tenantId: userTenantId } = req.user;
    const { tenantId } = req.query;
    console.log(`Get environments request for user ID: ${userId}, role: ${role}, tenant ID: ${tenantId}`);
    
    // Check if user has access to the tenant
    let hasAccess = false;
    
    // MSP users have access to all tenants
    if (role === 'msp') {
      hasAccess = true;
    } 
    // Admin users have access to their own tenant
    else if (role === 'admin' && userTenantId === tenantId) {
      hasAccess = true;
    }
    // Regular users have access to their own tenant
    else if (userTenantId === tenantId) {
      hasAccess = true;
    }
    
    if (!hasAccess) {
      console.log(`User ${userId} does not have access to tenant ${tenantId}`);
      return res.status(403).json({ error: 'Forbidden', details: 'You do not have access to this tenant' });
    }
    
    // For now, return a mock list of environments
    const environments = [
      { id: 'env-1', name: 'Development', description: 'Development environment', tenantId },
      { id: 'env-2', name: 'Staging', description: 'Staging environment', tenantId },
      { id: 'env-3', name: 'Production', description: 'Production environment', tenantId },
    ];
    
    console.log(`Environments retrieved successfully for tenant ID: ${tenantId}, count: ${environments.length}`);
    res.json(environments);
  } catch (error) {
    console.error('Get environments error:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Swagger UI for API documentation
app.use('/api/docs', swaggerUi.serve);
app.get('/api/docs', (req, res) => {
  const swaggerDocument = {
    openapi: '3.0.0',
    info: {
      title: 'Cloud Management Platform API',
      version: '1.0.0',
      description: 'API for the Cloud Management Platform'
    },
    paths: {
      '/api/auth/login': {
        post: {
          summary: 'Login',
          description: 'Authenticate a user with email and password',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    email: { type: 'string' },
                    password: { type: 'string' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'Successful login',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      user: { type: 'object' },
                      token: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/auth/verify': {
        get: {
          summary: 'Verify token',
          description: 'Verify JWT token and return user data',
          responses: {
            '200': {
              description: 'Token is valid',
              content: {
                'application/json': {
                  schema: {
                    type: 'object'
                  }
                }
              }
            }
          }
        }
      },
      '/api/auth/me': {
        get: {
          summary: 'Get user data',
          description: 'Get current user data',
          responses: {
            '200': {
              description: 'User data',
              content: {
                'application/json': {
                  schema: {
                    type: 'object'
                  }
                }
              }
            }
          }
        }
      },
      '/api/auth/tenants': {
        get: {
          summary: 'Get user tenants',
          description: 'Get all tenants a user has access to',
          responses: {
            '200': {
              description: 'List of tenants',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object'
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/auth/permission/{name}': {
        get: {
          summary: 'Check permission',
          description: 'Check if the user has a specific permission',
          parameters: [
            {
              name: 'name',
              in: 'path',
              required: true,
              schema: {
                type: 'string'
              },
              description: 'Permission name to check'
            }
          ],
          responses: {
            '200': {
              description: 'Permission check result',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      hasPermission: { type: 'boolean' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/deployments': {
        get: {
          summary: 'Get deployments',
          description: 'Get all deployments for a tenant',
          parameters: [
            {
              name: 'tenantId',
              in: 'query',
              required: true,
              schema: {
                type: 'string'
              }
            }
          ],
          responses: {
            '200': {
              description: 'List of deployments',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object'
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/cloud-accounts': {
        get: {
          summary: 'Get cloud accounts',
          description: 'Get all cloud accounts for a tenant',
          parameters: [
            {
              name: 'tenantId',
              in: 'query',
              required: true,
              schema: {
                type: 'string'
              }
            }
          ],
          responses: {
            '200': {
              description: 'List of cloud accounts',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object'
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/templates': {
        get: {
          summary: 'Get templates',
          description: 'Get all templates for a tenant',
          parameters: [
            {
              name: 'tenantId',
              in: 'query',
              required: true,
              schema: {
                type: 'string'
              }
            }
          ],
          responses: {
            '200': {
              description: 'List of templates',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object'
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/environments': {
        get: {
          summary: 'Get environments',
          description: 'Get all environments for a tenant',
          parameters: [
            {
              name: 'tenantId',
              in: 'query',
              required: true,
              schema: {
                type: 'string'
              }
            }
          ],
          responses: {
            '200': {
              description: 'List of environments',
              content: {
                'application/json': {
                  schema: {
                    type: 'array',
                    items: {
                      type: 'object'
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/api/health': {
        get: {
          summary: 'Health check',
          description: 'Check if the API server is running',
          responses: {
            '200': {
              description: 'API server is running',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string' },
                      timestamp: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  };
  
  return swaggerUi.setup(swaggerDocument)(req, res);
});

// Start server
app.listen(port, () => {
  console.log(`API server running on port ${port}`);
});

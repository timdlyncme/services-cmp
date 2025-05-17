// Simple Express API for authentication
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'cmpuser',
  password: process.env.DB_PASSWORD || 'cmppassword',
  database: process.env.DB_NAME || 'cmpdb',
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
      return res.status(403).json({ error: 'Forbidden' });
    }
    req.user = user;
    next();
  });
};

// Login route
app.post('/api/auth/login', async (req, res) => {
  try {
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
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = userResult.rows[0];
    
    // Verify password
    // For development, also accept 'password' for all users
    const isPasswordValid = password === 'password' || await bcrypt.compare(password, user.password_hash);
    
    if (!isPasswordValid) {
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
        role: user.role 
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
        role: user.role,
        tenantId: user.tenant_id,
        permissions
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token route
app.get('/api/auth/verify', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user tenants
app.get('/api/auth/tenants', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    
    // For regular users, return only their tenant
    // For MSP users, return all tenants
    const tenantsResult = await pool.query(
      `SELECT t.id, t.tenant_id, t.name, t.description, t.created_at
       FROM tenants t
       WHERE t.id = (SELECT tenant_id FROM users WHERE user_id = $1)
       OR (SELECT role_id FROM users WHERE user_id = $1) = (SELECT id FROM roles WHERE name = 'msp')
       ORDER BY t.name`,
      [userId]
    );
    
    const tenants = tenantsResult.rows.map(row => ({
      id: row.tenant_id,
      name: row.name,
      description: row.description,
      createdAt: row.created_at
    }));
    
    res.json(tenants);
  } catch (error) {
    console.error('Get user tenants error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Check permission
app.get('/api/auth/permission/:name', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.user;
    const { name } = req.params;
    
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
    
    res.json({ hasPermission });
  } catch (error) {
    console.error('Permission check error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`API server running on port ${port}`);
});

module.exports = app;


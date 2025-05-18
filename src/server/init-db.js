/**
 * Database initialization script
 * 
 * This script initializes the database with the necessary tables, roles, permissions, and sample data.
 * Run this script after setting up the PostgreSQL database.
 * 
 * Usage: node init-db.js
 */

const { Pool } = require('pg');
require('dotenv').config();

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'cmpuser',
  password: process.env.DB_PASSWORD || 'cmppassword',
  database: process.env.DB_NAME || 'cmpdb',
});

// Define permissions
const permissions = [
  { name: 'view:dashboard', description: 'View dashboard' },
  { name: 'view:deployments', description: 'View deployments' },
  { name: 'view:catalog', description: 'View template catalog' },
  { name: 'view:cloud-accounts', description: 'View cloud accounts' },
  { name: 'view:environments', description: 'View environments' },
  { name: 'view:templates', description: 'View templates' },
  { name: 'view:users', description: 'View users and groups' },
  { name: 'view:settings', description: 'View settings' },
  { name: 'view:tenants', description: 'View tenants' },
  { name: 'manage:templates', description: 'Manage templates' },
  { name: 'use:nexus-ai', description: 'Use NexusAI' }
];

// Define roles and their permissions
const roles = [
  { 
    name: 'user', 
    description: 'Regular user',
    permissions: ['view:dashboard', 'view:deployments', 'view:catalog']
  },
  { 
    name: 'admin', 
    description: 'Administrator',
    permissions: [
      'view:dashboard', 'view:deployments', 'view:catalog',
      'view:cloud-accounts', 'view:environments', 'view:templates',
      'view:users', 'view:settings'
    ]
  },
  { 
    name: 'msp', 
    description: 'Managed Service Provider',
    permissions: [
      'view:dashboard', 'view:deployments', 'view:catalog',
      'view:cloud-accounts', 'view:environments', 'view:templates',
      'view:users', 'view:settings', 'view:tenants',
      'manage:templates', 'use:nexus-ai'
    ]
  }
];

// Define tenants
const tenants = [
  { 
    tenant_id: 'tenant-1', 
    name: 'Acme Corp', 
    description: 'Main corporate tenant',
    created_at: new Date('2023-01-15T12:00:00Z')
  },
  { 
    tenant_id: 'tenant-2', 
    name: 'Dev Team', 
    description: 'Development team workspace',
    created_at: new Date('2023-02-20T09:30:00Z')
  },
  { 
    tenant_id: 'tenant-3', 
    name: 'Test Org', 
    description: 'Testing organization',
    created_at: new Date('2023-03-10T14:45:00Z')
  }
];

// Define users
const users = [
  {
    user_id: 'user-1',
    name: 'Admin User',
    email: 'admin@example.com',
    password: 'password', // In production, use bcrypt to hash passwords
    role: 'admin',
    tenant_id: 'tenant-1'
  },
  {
    user_id: 'user-2',
    name: 'Regular User',
    email: 'user@example.com',
    password: 'password',
    role: 'user',
    tenant_id: 'tenant-1'
  },
  {
    user_id: 'user-3',
    name: 'MSP User',
    email: 'msp@example.com',
    password: 'password',
    role: 'msp',
    tenant_id: 'tenant-2'
  }
];

// Initialize database
async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    // Start transaction
    await client.query('BEGIN');
    
    console.log('Creating tables...');
    
    // Create tenants table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id SERIAL PRIMARY KEY,
        tenant_id VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        description TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    // Create roles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT
      )
    `);
    
    // Create permissions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT
      )
    `);
    
    // Create role_permissions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        id SERIAL PRIMARY KEY,
        role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
        permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
        UNIQUE(role_id, permission_id)
      )
    `);
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(100) NOT NULL,
        role_id INTEGER REFERENCES roles(id) ON DELETE RESTRICT,
        tenant_id INTEGER REFERENCES tenants(id) ON DELETE RESTRICT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    // Create user_permissions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_permissions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
        UNIQUE(user_id, permission_id)
      )
    `);
    
    console.log('Tables created successfully');
    
    // Insert tenants
    console.log('Inserting tenants...');
    for (const tenant of tenants) {
      await client.query(
        `INSERT INTO tenants (tenant_id, name, description, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (tenant_id) DO UPDATE
         SET name = $2, description = $3`,
        [tenant.tenant_id, tenant.name, tenant.description, tenant.created_at]
      );
    }
    
    // Insert roles
    console.log('Inserting roles...');
    for (const role of roles) {
      await client.query(
        `INSERT INTO roles (name, description)
         VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE
         SET description = $2`,
        [role.name, role.description]
      );
    }
    
    // Insert permissions
    console.log('Inserting permissions...');
    for (const permission of permissions) {
      await client.query(
        `INSERT INTO permissions (name, description)
         VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE
         SET description = $2`,
        [permission.name, permission.description]
      );
    }
    
    // Insert role permissions
    console.log('Inserting role permissions...');
    for (const role of roles) {
      const roleResult = await client.query(
        'SELECT id FROM roles WHERE name = $1',
        [role.name]
      );
      
      const roleId = roleResult.rows[0].id;
      
      for (const permissionName of role.permissions) {
        const permissionResult = await client.query(
          'SELECT id FROM permissions WHERE name = $1',
          [permissionName]
        );
        
        if (permissionResult.rows.length > 0) {
          const permissionId = permissionResult.rows[0].id;
          
          await client.query(
            `INSERT INTO role_permissions (role_id, permission_id)
             VALUES ($1, $2)
             ON CONFLICT (role_id, permission_id) DO NOTHING`,
            [roleId, permissionId]
          );
        }
      }
    }
    
    // Insert users
    console.log('Inserting users...');
    for (const user of users) {
      const roleResult = await client.query(
        'SELECT id FROM roles WHERE name = $1',
        [user.role]
      );
      
      const tenantResult = await client.query(
        'SELECT id FROM tenants WHERE tenant_id = $1',
        [user.tenant_id]
      );
      
      if (roleResult.rows.length > 0 && tenantResult.rows.length > 0) {
        const roleId = roleResult.rows[0].id;
        const tenantId = tenantResult.rows[0].id;
        
        // In production, use bcrypt to hash passwords
        const passwordHash = user.password; // This is just for demo purposes
        
        await client.query(
          `INSERT INTO users (user_id, name, email, password_hash, role_id, tenant_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (user_id) DO UPDATE
           SET name = $2, email = $3, password_hash = $4, role_id = $5, tenant_id = $6`,
          [user.user_id, user.name, user.email, passwordHash, roleId, tenantId]
        );
      }
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log('Database initialized successfully');
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('Error initializing database:', error);
  } finally {
    // Release client
    client.release();
  }
}

// Run initialization
initializeDatabase()
  .then(() => {
    console.log('Database initialization completed');
    pool.end();
  })
  .catch((error) => {
    console.error('Database initialization failed:', error);
    pool.end();
  });


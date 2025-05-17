import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from './db';
import { User, Tenant, UserRole, Permission } from '@/types/auth';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key_change_in_production';

export interface AuthUser extends User {
  permissions: Permission[];
}

export class AuthService {
  /**
   * Authenticate a user with email and password
   */
  async login(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
    try {
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
        throw new Error('Invalid credentials');
      }

      const user = userResult.rows[0];

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      if (!isPasswordValid) {
        throw new Error('Invalid credentials');
      }

      // Get user permissions (from role and custom permissions)
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
      const authUser: AuthUser = {
        id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role as UserRole,
        tenantId: user.tenant_id,
        permissions
      };

      return { user: authUser, token };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Verify JWT token and return user data
   */
  async verifyToken(token: string): Promise<AuthUser | null> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string; role: string };
      
      // Get user data
      const userResult = await pool.query(
        `SELECT u.id, u.user_id, u.name, u.email, r.name as role, t.tenant_id, t.name as tenant_name
         FROM users u
         JOIN roles r ON u.role_id = r.id
         JOIN tenants t ON u.tenant_id = t.id
         WHERE u.user_id = $1`,
        [decoded.userId]
      );

      if (userResult.rows.length === 0) {
        return null;
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
        [decoded.userId]
      );

      const permissions = permissionsResult.rows.map(row => ({
        name: row.name,
        description: row.description
      }));

      // Return user data
      return {
        id: user.user_id,
        name: user.name,
        email: user.email,
        role: user.role as UserRole,
        tenantId: user.tenant_id,
        permissions
      };
    } catch (error) {
      console.error('Token verification error:', error);
      return null;
    }
  }

  /**
   * Get all tenants a user has access to
   */
  async getUserTenants(userId: string): Promise<Tenant[]> {
    try {
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

      return tenantsResult.rows.map(row => ({
        id: row.tenant_id,
        name: row.name,
        description: row.description,
        createdAt: row.created_at
      }));
    } catch (error) {
      console.error('Get user tenants error:', error);
      return [];
    }
  }

  /**
   * Check if a user has a specific permission
   */
  async hasPermission(userId: string, permissionName: string): Promise<boolean> {
    try {
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
        [permissionName, userId]
      );

      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      console.error('Permission check error:', error);
      return false;
    }
  }
}


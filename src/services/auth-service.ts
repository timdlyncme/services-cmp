import axios from 'axios';
import { User, Tenant, UserRole, Permission } from '@/types/auth';

// API base URL
const API_URL = 'http://localhost:3001/api';

export interface AuthUser extends User {
  permissions: Permission[];
}

export class AuthService {
  /**
   * Authenticate a user with email and password
   */
  async login(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { email, password });
      return response.data;
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
      const response = await axios.get(`${API_URL}/auth/verify`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
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
      const token = localStorage.getItem('token');
      if (!token) {
        return [];
      }

      const response = await axios.get(`${API_URL}/auth/tenants`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
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
      const token = localStorage.getItem('token');
      if (!token) {
        return false;
      }

      const response = await axios.get(`${API_URL}/auth/permission/${permissionName}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data.hasPermission;
    } catch (error) {
      console.error('Permission check error:', error);
      return false;
    }
  }
}


import axios from 'axios';
import { User, Tenant, UserRole, Permission } from '@/types/auth';

// API base URL
const API_URL = 'http://localhost:3001/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export interface AuthUser extends User {
  permissions: Permission[];
}

export class AuthService {
  /**
   * Authenticate a user with email and password
   */
  async login(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
    try {
      console.log('Attempting login for:', email);
      const response = await api.post('/auth/login', { email, password });
      console.log('Login successful');
      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      if (axios.isAxiosError(error)) {
        if (error.code === 'ERR_NETWORK') {
          throw new Error('Cannot connect to authentication server. Please make sure the server is running.');
        } else if (error.response) {
          throw new Error(error.response.data.error || 'Authentication failed');
        }
      }
      throw error;
    }
  }

  /**
   * Verify JWT token and return user data
   */
  async verifyToken(token: string): Promise<AuthUser | null> {
    try {
      const response = await api.get('/auth/verify', {
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

      const response = await api.get('/auth/tenants', {
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

      const response = await api.get(`/auth/permission/${permissionName}`, {
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

  /**
   * Check if the API server is running
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await api.get('/health');
      return response.data.status === 'ok';
    } catch (error) {
      console.error('Health check error:', error);
      return false;
    }
  }
}

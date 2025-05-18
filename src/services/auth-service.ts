import axios from 'axios';
import { User, Tenant, UserRole, Permission } from '@/types/auth';

// API base URL
const API_URL = 'http://localhost:8000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: false // Disable sending cookies for cross-domain requests
});

// Add request interceptor to add token to all requests
api.interceptors.request.use(
  (config) => {
    // Don't add token for login request
    if (config.url === '/auth/login') {
      return config;
    }
    
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API error:', error);
    
    // Handle specific error cases
    if (error.code === 'ERR_NETWORK') {
      console.error('Network error - API server may be down');
    } else if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('API error response:', error.response.status, error.response.data);
      
      if (error.response.status === 401 && error.config.url !== '/auth/login') {
        // Unauthorized - token may be invalid or expired
        localStorage.removeItem('token');
        localStorage.removeItem('currentTenantId');
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

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
      
      // FastAPI uses form data for OAuth2 login
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);
      
      const response = await api.post('/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        }
      });
      
      console.log('Login successful');
      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      if (axios.isAxiosError(error)) {
        if (error.code === 'ERR_NETWORK') {
          throw new Error('Cannot connect to authentication server. Please make sure the server is running.');
        } else if (error.response) {
          throw new Error(error.response.data.detail || 'Authentication failed');
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
      // First verify the token
      await api.get('/auth/verify');
      
      // Then get the user data
      const response = await api.get('/auth/me');
      
      // Add default name if not provided
      if (!response.data.name) {
        response.data.name = response.data.email || 'User';
      }
      
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
      const response = await api.get('/auth/tenants');
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
      const response = await api.get(`/auth/permission/${permissionName}`);
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

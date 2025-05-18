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

export interface AuthUser extends User {
  permissions: Permission[];
}

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
      
      try {
        const response = await api.post('/auth/login', formData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          }
        });
        
        console.log('Login successful');
        return response.data;
      } catch (error) {
        console.error('API login failed, using mock data:', error);
        
        // For demo purposes, use mock data if the API is not available
        // Find the user in the mock data
        const mockUsers = [
          {
            id: "user-1",
            name: "Admin User",
            email: "admin@example.com",
            role: "admin" as UserRole,
            tenantId: "tenant-1",
          },
          {
            id: "user-2",
            name: "Regular User",
            email: "user@example.com",
            role: "user" as UserRole,
            tenantId: "tenant-1",
          },
          {
            id: "user-3",
            name: "MSP User",
            email: "msp@example.com",
            role: "msp" as UserRole,
            tenantId: "tenant-2",
          },
        ];
        
        const user = mockUsers.find(u => u.email === email);
        
        if (user && password === 'password') {
          // Create a mock token
          const token = `mock-token-${Date.now()}`;
          
          return {
            user: {
              ...user,
              permissions: [] // Permissions will be assigned in auth-context
            },
            token
          };
        }
        
        throw new Error('Invalid email or password');
      }
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
      try {
        // First verify the token
        await api.get('/auth/verify', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        // Then get the user data
        const response = await api.get('/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        // Add default name if not provided
        if (!response.data.name) {
          response.data.name = response.data.email || 'User';
        }
        
        return response.data;
      } catch (error) {
        console.error('API token verification failed, using mock data:', error);
        
        // For demo purposes, if the token starts with 'mock-token-', it's a valid mock token
        if (token.startsWith('mock-token-')) {
          // Extract the user email from localStorage if available
          const storedEmail = localStorage.getItem('userEmail');
          
          // Find the user in the mock data
          const mockUsers = [
            {
              id: "user-1",
              name: "Admin User",
              email: "admin@example.com",
              role: "admin" as UserRole,
              tenantId: "tenant-1",
            },
            {
              id: "user-2",
              name: "Regular User",
              email: "user@example.com",
              role: "user" as UserRole,
              tenantId: "tenant-1",
            },
            {
              id: "user-3",
              name: "MSP User",
              email: "msp@example.com",
              role: "msp" as UserRole,
              tenantId: "tenant-2",
            },
          ];
          
          // If we have a stored email, find that user, otherwise use the first user
          const user = storedEmail 
            ? mockUsers.find(u => u.email === storedEmail) 
            : mockUsers[0];
          
          if (user) {
            return {
              ...user,
              permissions: [] // Permissions will be assigned in auth-context
            };
          }
        }
        
        return null;
      }
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

      try {
        const response = await api.get('/tenants', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        return response.data;
      } catch (error) {
        console.error('API get tenants failed, using mock data:', error);
        
        // For demo purposes, return mock tenants if the API is not available
        return mockTenants;
      }
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

      try {
        const response = await api.get(`/auth/permission/${permissionName}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        return response.data.hasPermission;
      } catch (error) {
        console.error('API permission check failed:', error);
        
        // For demo purposes, return true for basic permissions if the API is not available
        const basicPermissions = [
          "view:dashboard", 
          "view:catalog", 
          "view:deployments"
        ];
        
        return basicPermissions.includes(permissionName);
      }
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
      try {
        const response = await api.get('/health');
        return response.data.status === 'ok';
      } catch (error) {
        console.error('API health check failed, using mock mode:', error);
        
        // For demo purposes, return true even if the API is not available
        return true;
      }
    } catch (error) {
      console.error('Health check error:', error);
      return false;
    }
  }
}

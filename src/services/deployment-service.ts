import axios from 'axios';
import { CloudDeployment, CloudAccount, CloudTemplate } from '@/types/cloud';

// API base URL
const API_URL = 'http://localhost:8000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: false
});

// Add request interceptor to add token to all requests
api.interceptors.request.use(
  (config) => {
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
      
      if (error.response.status === 401) {
        // Unauthorized - token may be invalid or expired
        localStorage.removeItem('token');
        localStorage.removeItem('currentTenantId');
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export class DeploymentService {
  /**
   * Get all deployments for a tenant
   */
  async getDeployments(tenantId: string): Promise<CloudDeployment[]> {
    try {
      const response = await api.get('/deployments', {
        params: {
          tenantId
        }
      });
      return response.data;
    } catch (error) {
      console.error('Get deployments error:', error);
      throw error;
    }
  }

  /**
   * Get a deployment by ID
   */
  async getDeployment(deploymentId: string): Promise<CloudDeployment | null> {
    try {
      const response = await api.get(`/deployments/${deploymentId}`);
      return response.data;
    } catch (error) {
      console.error(`Get deployment ${deploymentId} error:`, error);
      return null;
    }
  }

  /**
   * Get all cloud accounts for a tenant
   */
  async getCloudAccounts(tenantId: string): Promise<CloudAccount[]> {
    try {
      const response = await api.get('/cloud-accounts', {
        params: {
          tenantId
        }
      });
      return response.data;
    } catch (error) {
      console.error('Get cloud accounts error:', error);
      throw error;
    }
  }

  /**
   * Get all templates for a tenant
   */
  async getTemplates(tenantId: string): Promise<CloudTemplate[]> {
    try {
      const response = await api.get('/templates', {
        params: {
          tenantId
        }
      });
      return response.data;
    } catch (error) {
      console.error('Get templates error:', error);
      throw error;
    }
  }

  /**
   * Get all environments for a tenant
   */
  async getEnvironments(tenantId: string): Promise<any[]> {
    try {
      const response = await api.get('/environments', {
        params: {
          tenantId
        }
      });
      return response.data;
    } catch (error) {
      console.error('Get environments error:', error);
      throw error;
    }
  }
}

// Create a singleton instance
export const deploymentService = new DeploymentService();

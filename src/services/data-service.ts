import axios from 'axios';
import { CloudAccount, CloudDeployment, CloudTemplate, IntegrationConfig } from '@/types/cloud';
import { mockCloudAccounts, mockDeployments, mockTemplates, mockIntegrationConfigs } from '@/data/mock-data';

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

// Add authorization token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export class DataService {
  /**
   * Get cloud accounts for the current tenant
   */
  async getCloudAccounts(tenantId: string): Promise<CloudAccount[]> {
    try {
      try {
        const response = await api.get(`/cloud-accounts?tenant_id=${tenantId}`);
        return response.data;
      } catch (error) {
        console.error('API get cloud accounts failed, using mock data:', error);
        // For demo purposes, return filtered mock data if the API is not available
        return mockCloudAccounts.filter(account => account.tenantId === tenantId);
      }
    } catch (error) {
      console.error('Get cloud accounts error:', error);
      return [];
    }
  }

  /**
   * Get deployments for the current tenant
   */
  async getDeployments(tenantId: string): Promise<CloudDeployment[]> {
    try {
      try {
        const response = await api.get(`/deployments?tenant_id=${tenantId}`);
        return response.data;
      } catch (error) {
        console.error('API get deployments failed, using mock data:', error);
        // For demo purposes, return filtered mock data if the API is not available
        return mockDeployments.filter(deployment => deployment.tenantId === tenantId);
      }
    } catch (error) {
      console.error('Get deployments error:', error);
      return [];
    }
  }

  /**
   * Get deployment by ID
   */
  async getDeploymentById(deploymentId: string): Promise<CloudDeployment | null> {
    try {
      try {
        const response = await api.get(`/deployments/${deploymentId}`);
        return response.data;
      } catch (error) {
        console.error('API get deployment by ID failed, using mock data:', error);
        // For demo purposes, return mock data if the API is not available
        return mockDeployments.find(deployment => deployment.id === deploymentId) || null;
      }
    } catch (error) {
      console.error('Get deployment by ID error:', error);
      return null;
    }
  }

  /**
   * Get templates for the current tenant
   */
  async getTemplates(tenantId: string): Promise<CloudTemplate[]> {
    try {
      try {
        const response = await api.get(`/templates?tenant_id=${tenantId}`);
        return response.data;
      } catch (error) {
        console.error('API get templates failed, using mock data:', error);
        // For demo purposes, return filtered mock data if the API is not available
        return mockTemplates.filter(template => template.tenantId === tenantId);
      }
    } catch (error) {
      console.error('Get templates error:', error);
      return [];
    }
  }

  /**
   * Get template by ID
   */
  async getTemplateById(templateId: string): Promise<CloudTemplate | null> {
    try {
      try {
        const response = await api.get(`/templates/${templateId}`);
        return response.data;
      } catch (error) {
        console.error('API get template by ID failed, using mock data:', error);
        // For demo purposes, return mock data if the API is not available
        return mockTemplates.find(template => template.id === templateId) || null;
      }
    } catch (error) {
      console.error('Get template by ID error:', error);
      return null;
    }
  }

  /**
   * Get integration configs for the current tenant
   */
  async getIntegrationConfigs(tenantId: string): Promise<IntegrationConfig[]> {
    try {
      try {
        const response = await api.get(`/integrations?tenant_id=${tenantId}`);
        return response.data;
      } catch (error) {
        console.error('API get integration configs failed, using mock data:', error);
        // For demo purposes, return filtered mock data if the API is not available
        return mockIntegrationConfigs.filter(config => config.tenantId === tenantId);
      }
    } catch (error) {
      console.error('Get integration configs error:', error);
      return [];
    }
  }

  /**
   * Get environments for the current tenant
   */
  async getEnvironments(tenantId: string): Promise<any[]> {
    try {
      try {
        const response = await api.get(`/environments?tenant_id=${tenantId}`);
        return response.data;
      } catch (error) {
        console.error('API get environments failed, using mock data:', error);
        // For demo purposes, return mock data if the API is not available
        return [
          { id: 'env-1', name: 'Development', tenantId },
          { id: 'env-2', name: 'Staging', tenantId },
          { id: 'env-3', name: 'Production', tenantId }
        ];
      }
    } catch (error) {
      console.error('Get environments error:', error);
      return [];
    }
  }

  /**
   * Get users for the current tenant
   */
  async getUsers(tenantId: string): Promise<any[]> {
    try {
      try {
        const response = await api.get(`/users?tenant_id=${tenantId}`);
        return response.data;
      } catch (error) {
        console.error('API get users failed, using mock data:', error);
        // For demo purposes, return mock data if the API is not available
        return [
          { id: 'user-1', name: 'Admin User', email: 'admin@example.com', role: 'admin', tenantId },
          { id: 'user-2', name: 'Regular User', email: 'user@example.com', role: 'user', tenantId },
          { id: 'user-3', name: 'MSP User', email: 'msp@example.com', role: 'msp', tenantId }
        ];
      }
    } catch (error) {
      console.error('Get users error:', error);
      return [];
    }
  }
}

// Create a singleton instance
export const dataService = new DataService();


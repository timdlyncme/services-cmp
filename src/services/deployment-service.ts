import axios from 'axios';
import { CloudDeployment, CloudAccount, CloudTemplate, DeploymentLog } from '@/types/cloud';

// API base URL for backend services
const API_URL = 'http://localhost:8000/api';

// Deployment engine URL for specific endpoints
const DEPLOYMENT_ENGINE_URL = 'http://localhost:5000';

// Create axios instance with default config for backend
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: false
});

// Create axios instance for deployment engine
const deploymentEngineApi = axios.create({
  baseURL: DEPLOYMENT_ENGINE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: false
});

// Helper function to ensure tenant ID is in the correct format
const formatTenantId = (tenantId: string | number): string => {
  // Convert to string if it's not already
  const tenantIdStr = String(tenantId);
  
  // If the ID is already in the format "tenant-X", extract the UUID part
  if (tenantIdStr.startsWith('tenant-')) {
    console.warn('Warning: Using "tenant-" prefix is deprecated. Use raw UUID instead.');
    return tenantIdStr.substring(7); // Remove 'tenant-' prefix
  }
  
  // Otherwise, return as is (assuming it's already a UUID)
  return tenantIdStr;
};

export class DeploymentService {
  /**
   * Get all deployments for a tenant
   */
  async getDeployments(tenantId: string): Promise<CloudDeployment[]> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return [];
      }

      const response = await api.get('/deployments', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          tenant_id: formatTenantId(tenantId)
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
      const token = localStorage.getItem('token');
      if (!token) {
        return null;
      }

      const response = await api.get(`/deployments/${deploymentId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Get deployment ${deploymentId} error:`, error);
      return null;
    }
  }

  /**
   * Get logs for a deployment
   */
  async getDeploymentLogs(deploymentId: string): Promise<DeploymentLog[]> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return [];
      }

      const response = await api.get(`/deployments/${deploymentId}/logs`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Get deployment logs for ${deploymentId} error:`, error);
      return [];
    }
  }

  /**
   * Get all cloud accounts for a tenant
   */
  async getCloudAccounts(tenantId: string): Promise<CloudAccount[]> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return [];
      }

      const response = await api.get('/cloud-accounts', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          tenant_id: formatTenantId(tenantId)
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
      const token = localStorage.getItem('token');
      if (!token) {
        return [];
      }

      const response = await api.get('/templates', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          tenant_id: formatTenantId(tenantId)
        }
      });
      return response.data;
    } catch (error) {
      console.error('Get templates error:', error);
      throw error;
    }
  }

  /**
   * Create a new deployment
   */
  async createDeployment(deploymentData: any, tenantId: string): Promise<CloudDeployment> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await api.post('/deployments', deploymentData, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          tenant_id: formatTenantId(tenantId)
        }
      });
      return response.data;
    } catch (error) {
      console.error('Create deployment error:', error);
      throw error;
    }
  }

  /**
   * Delete a deployment
   */
  async deleteDeployment(deploymentId: string): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      await api.delete(`/deployments/${deploymentId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error(`Delete deployment ${deploymentId} error:`, error);
      throw error;
    }
  }

  /**
   * Get subscription locations from Azure
   */
  async getSubscriptionLocations(tenantId?: string, settingsId?: string, subscriptionId?: string): Promise<any> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const params: any = {};
      if (tenantId) {
        params.target_tenant_id = formatTenantId(tenantId);
      }
      if (settingsId) {
        params.settings_id = settingsId;
      }
      if (subscriptionId) {
        params.subscription_id = subscriptionId;
      }

      const response = await deploymentEngineApi.get('/resources/subscription_locations', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params
      });
      return response.data;
    } catch (error) {
      console.error('Get subscription locations error:', error);
      throw error;
    }
  }

  /**
   * Query Azure Resource Graph
   */
  async queryResourceGraph(query: string, tenantId?: string, settingsId?: string, subscriptionId?: string): Promise<any> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const params: any = { query };
      if (tenantId) {
        params.target_tenant_id = formatTenantId(tenantId);
      }
      if (settingsId) {
        params.settings_id = settingsId;
      }
      if (subscriptionId) {
        params.subscription_id = subscriptionId;
      }

      const response = await deploymentEngineApi.get('/resourcegraph', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params
      });
      return response.data;
    } catch (error) {
      console.error('Query resource graph error:', error);
      throw error;
    }
  }
}

// Create a singleton instance
export const deploymentService = new DeploymentService();

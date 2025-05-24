import axios from 'axios';
import { CloudDeployment, CloudAccount, CloudTemplate, DeploymentLog } from '@/types/cloud';

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
}

// Create a singleton instance
export const deploymentService = new DeploymentService();

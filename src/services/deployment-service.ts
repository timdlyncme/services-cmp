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

// Helper function to ensure tenant ID is in the correct format
const formatTenantId = (tenantId: string): string => {
  // If the ID is already in the format "tenant-X", return it as is
  if (tenantId.startsWith('tenant-')) {
    return tenantId;
  }
  
  // Otherwise, format it as "tenant-X"
  return `tenant-${tenantId}`;
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
}

// Create a singleton instance
export const deploymentService = new DeploymentService();

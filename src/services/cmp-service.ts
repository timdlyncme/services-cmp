import axios from 'axios';
import { 
  CloudAccount, 
  CloudTemplate, 
  CloudDeployment,
  IntegrationConfig
} from '@/types/cloud';
import { User, Tenant } from '@/types/auth';

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
  
  // If the ID is already in the format "tenant-X", return it as is
  if (tenantIdStr.startsWith('tenant-')) {
    return tenantIdStr;
  }
  
  // Otherwise, format it as "tenant-X"
  return `tenant-${tenantIdStr}`;
};

export class CMPService {
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
   * Get a cloud account by ID
   */
  async getCloudAccount(accountId: string): Promise<CloudAccount | null> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return null;
      }

      const response = await api.get(`/cloud-accounts/${accountId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Get cloud account ${accountId} error:`, error);
      return null;
    }
  }

  /**
   * Create a new cloud account
   */
  async createCloudAccount(account: Partial<CloudAccount>, tenantId: string): Promise<CloudAccount> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await api.post('/cloud-accounts', {
        ...account,
        tenant_id: formatTenantId(tenantId)
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Create cloud account error:', error);
      throw error;
    }
  }

  /**
   * Update a cloud account
   */
  async updateCloudAccount(accountId: string, account: Partial<CloudAccount>): Promise<CloudAccount> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await api.put(`/cloud-accounts/${accountId}`, account, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Update cloud account ${accountId} error:`, error);
      throw error;
    }
  }

  /**
   * Delete a cloud account
   */
  async deleteCloudAccount(accountId: string): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      await api.delete(`/cloud-accounts/${accountId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error(`Delete cloud account ${accountId} error:`, error);
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
   * Get a template by ID
   */
  async getTemplate(templateId: string): Promise<CloudTemplate | null> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return null;
      }

      const response = await api.get(`/templates/${templateId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Get template ${templateId} error:`, error);
      return null;
    }
  }

  /**
   * Create a new template
   */
  async createTemplate(template: Partial<CloudTemplate>, tenantId: string): Promise<CloudTemplate> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await api.post('/templates', {
        ...template,
        tenant_id: formatTenantId(tenantId)
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Create template error:', error);
      throw error;
    }
  }

  /**
   * Update a template
   */
  async updateTemplate(templateId: string, template: Partial<CloudTemplate>): Promise<CloudTemplate> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await api.put(`/templates/${templateId}`, template, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Update template ${templateId} error:`, error);
      throw error;
    }
  }

  /**
   * Delete a template
   */
  async deleteTemplate(templateId: string): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      await api.delete(`/templates/${templateId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error(`Delete template ${templateId} error:`, error);
      throw error;
    }
  }

  /**
   * Get all environments for a tenant
   */
  async getEnvironments(tenantId: string): Promise<any[]> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return [];
      }

      const response = await api.get('/environments', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          tenant_id: formatTenantId(tenantId)
        }
      });
      return response.data;
    } catch (error) {
      console.error('Get environments error:', error);
      throw error;
    }
  }

  /**
   * Get an environment by ID
   */
  async getEnvironment(environmentId: string): Promise<any | null> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return null;
      }

      const response = await api.get(`/environments/${environmentId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Get environment ${environmentId} error:`, error);
      return null;
    }
  }

  /**
   * Create a new environment
   */
  async createEnvironment(environment: any, tenantId: string): Promise<any> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await api.post('/environments', {
        ...environment,
        tenant_id: formatTenantId(tenantId)
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Create environment error:', error);
      throw error;
    }
  }

  /**
   * Update an environment
   */
  async updateEnvironment(environmentId: string, environment: any): Promise<any> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await api.put(`/environments/${environmentId}`, environment, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Update environment ${environmentId} error:`, error);
      throw error;
    }
  }

  /**
   * Delete an environment
   */
  async deleteEnvironment(environmentId: string): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      await api.delete(`/environments/${environmentId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error(`Delete environment ${environmentId} error:`, error);
      throw error;
    }
  }

  /**
   * Get all tenants
   */
  async getTenants(): Promise<Tenant[]> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return [];
      }

      const response = await api.get('/tenants', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Get tenants error:', error);
      throw error;
    }
  }

  /**
   * Get a tenant by ID
   */
  async getTenant(tenantId: string): Promise<Tenant | null> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return null;
      }

      const response = await api.get(`/tenants/${tenantId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Get tenant ${tenantId} error:`, error);
      return null;
    }
  }

  /**
   * Get all users for a tenant
   */
  async getUsers(tenantId: string): Promise<User[]> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return [];
      }

      const response = await api.get('/users', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          tenant_id: formatTenantId(tenantId)
        }
      });
      return response.data;
    } catch (error) {
      console.error('Get users error:', error);
      throw error;
    }
  }

  /**
   * Get a user by ID
   */
  async getUser(userId: string): Promise<User | null> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return null;
      }

      const response = await api.get(`/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      console.error(`Get user ${userId} error:`, error);
      return null;
    }
  }

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
}

// Create a singleton instance
export const cmpService = new CMPService();


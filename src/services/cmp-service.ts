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
  
  // If the ID is already in the format "tenant-X", extract the UUID part
  if (tenantIdStr.startsWith('tenant-')) {
    console.warn('Warning: Using "tenant-" prefix is deprecated. Use raw UUID instead.');
    return tenantIdStr.substring(7); // Remove 'tenant-' prefix
  }
  
  // Otherwise, return as is (assuming it's already a UUID)
  return tenantIdStr;
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

      console.log("Creating cloud account with data:", account);

      const response = await api.post('/cloud-accounts', {
        ...account
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          tenant_id: formatTenantId(tenantId)
        }
      });
      
      console.log("Cloud account created successfully:", response.data);
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
          tenant_id: tenantId
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching templates:', error);
      throw error;
    }
  }

  /**
   * Get template categories with counts
   */
  async getTemplateCategories(tenantId: string): Promise<Record<string, number>> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return {};
      }

      const response = await api.get('/templates/categories', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          tenant_id: tenantId
        }
      });

      return response.data;
    } catch (error) {
      console.error('Error fetching template categories:', error);
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

      console.log("Creating template with data:", {
        ...template,
        code: template.code ? `${template.code.substring(0, 100)}...` : 'No code',
        type: template.type,
        category: template.category
      });

      // Make sure we're sending the correct template type and category
      const templateData = {
        ...template,
        type: template.type, // Ensure type is explicitly set
        category: template.category, // Ensure category is explicitly set
      };

      const response = await api.post('/templates', templateData, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          tenant_id: formatTenantId(tenantId)
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
        ...environment
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          tenant_id: formatTenantId(tenantId)
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
  async getTenants(): Promise<any[]> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
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
   * Get a specific tenant
   */
  async getTenant(tenantId: string): Promise<any> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await api.get(`/tenants/${tenantId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Get tenant error:', error);
      throw error;
    }
  }

  /**
   * Create a new tenant
   */
  async createTenant(tenant: any): Promise<any> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await api.post('/tenants', {
        ...tenant
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Create tenant error:', error);
      throw error;
    }
  }

  /**
   * Update a tenant
   */
  async updateTenant(tenantId: string, tenant: any): Promise<any> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await api.put(`/tenants/${tenantId}`, {
        ...tenant
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Update tenant error:', error);
      throw error;
    }
  }

  /**
   * Delete a tenant
   */
  async deleteTenant(tenantId: string): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      await api.delete(`/tenants/${tenantId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Delete tenant error:', error);
      throw error;
    }
  }

  /**
   * Get all users
   */
  async getUsers(tenantId: string): Promise<any[]> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
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
   * Get a specific user
   */
  async getUser(userId: string): Promise<any> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await api.get(`/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Get user error:', error);
      throw error;
    }
  }

  /**
   * Create a new user
   */
  async createUser(user: any, tenantId: string): Promise<any> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await api.post('/users', {
        ...user
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          tenant_id: formatTenantId(tenantId)
        }
      });
      return response.data;
    } catch (error) {
      console.error('Create user error:', error);
      throw error;
    }
  }

  /**
   * Update a user
   */
  async updateUser(userId: string, user: any): Promise<any> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await api.put(`/users/${userId}`, {
        ...user
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Update user error:', error);
      throw error;
    }
  }

  /**
   * Delete a user
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      await api.delete(`/users/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Delete user error:', error);
      throw error;
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

  /**
   * Get all templates from the template foundry
   */
  async getTemplateFoundry(tenantId: string): Promise<any[]> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await api.get('/template-foundry', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          tenant_id: formatTenantId(tenantId)
        }
      });
      return response.data;
    } catch (error) {
      console.error('Get template foundry error:', error);
      throw error;
    }
  }

  /**
   * Get a specific template from the template foundry
   */
  async getTemplateFoundryItem(templateId: string): Promise<any> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await api.get(`/template-foundry/${templateId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Get template foundry item error:', error);
      throw error;
    }
  }

  /**
   * Create a new template in the template foundry
   */
  async createTemplateFoundryItem(template: any, tenantId: string): Promise<any> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await api.post('/template-foundry', {
        ...template
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          tenant_id: formatTenantId(tenantId)
        }
      });
      return response.data;
    } catch (error) {
      console.error('Create template foundry item error:', error);
      throw error;
    }
  }

  /**
   * Update a template in the template foundry
   */
  async updateTemplateFoundryItem(templateId: string, template: any): Promise<any> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await api.put(`/template-foundry/${templateId}`, {
        ...template
      }, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      return response.data;
    } catch (error) {
      console.error('Update template foundry item error:', error);
      throw error;
    }
  }

  /**
   * Delete a template from the template foundry
   */
  async deleteTemplateFoundryItem(templateId: string): Promise<void> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      await api.delete(`/template-foundry/${templateId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
    } catch (error) {
      console.error('Delete template foundry item error:', error);
      throw error;
    }
  }

  /**
   * Get all Azure credentials for the tenant
   */
  async getAzureCredentials(tenantId: string): Promise<any[]> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return [];
      }

      const response = await api.get('/deployments/azure_credentials', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          tenant_id: formatTenantId(tenantId)
        }
      });
      return response.data;
    } catch (error) {
      console.error('Get Azure credentials error:', error);
      throw error;
    }
  }

  /**
   * Get Azure subscriptions for a specific credential
   */
  async getAzureSubscriptions(settingsId: string, tenantId?: string): Promise<any[]> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        return [];
      }

      const params: Record<string, string> = {};
      if (tenantId) {
        params.tenant_id = formatTenantId(tenantId);
      }

      const response = await api.get(`/deployments/azure_credentials/${settingsId}/subscriptions`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params
      });
      return response.data;
    } catch (error) {
      console.error('Get Azure subscriptions error:', error);
      throw error;
    }
  }

  /**
   * Create a new Azure credential set
   */
  async createAzureCredential(credential: { name: string, client_id: string, client_secret: string, tenant_id: string }, tenantId?: string): Promise<any> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const params: Record<string, string> = {};
      if (tenantId) {
        params.tenant_id = formatTenantId(tenantId);
      }

      const response = await api.post('/deployments/azure_credentials', credential, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params
      });
      return response.data;
    } catch (error) {
      console.error('Create Azure credential error:', error);
      throw error;
    }
  }

  /**
   * Delete an Azure credential set
   */
  async deleteAzureCredential(settingsId: string, tenantId?: string): Promise<any> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const params: Record<string, string> = {};
      if (tenantId) {
        params.tenant_id = formatTenantId(tenantId);
      }

      const response = await api.delete(`/deployments/azure_credentials/${settingsId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params
      });
      return response.data;
    } catch (error) {
      console.error('Delete Azure credential error:', error);
      throw error;
    }
  }
}

// Create a singleton instance
export const cmpService = new CMPService();

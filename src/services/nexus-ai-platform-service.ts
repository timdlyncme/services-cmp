import { cmpService } from './cmp-service';
import { CloudAccount, CloudTemplate, CloudDeployment } from '@/types/cloud';
import { User, Tenant } from '@/types/auth';

/**
 * Service to provide platform data to NexusAI
 */
export class NexusAIPlatformService {
  /**
   * Get all tenants
   */
  async getTenants(): Promise<Tenant[]> {
    try {
      return await cmpService.getTenants();
    } catch (error) {
      console.error('Error fetching tenants for NexusAI:', error);
      return [];
    }
  }

  /**
   * Get all deployments for a tenant
   */
  async getDeployments(tenantId: string): Promise<CloudDeployment[]> {
    try {
      return await cmpService.getDeployments(tenantId);
    } catch (error) {
      console.error(`Error fetching deployments for tenant ${tenantId} for NexusAI:`, error);
      return [];
    }
  }

  /**
   * Get all deployments across all tenants
   */
  async getAllDeployments(): Promise<{ tenant: Tenant; deployments: CloudDeployment[] }[]> {
    try {
      const tenants = await this.getTenants();
      const results = await Promise.all(
        tenants.map(async (tenant) => {
          const deployments = await this.getDeployments(tenant.tenant_id);
          return { tenant, deployments };
        })
      );
      return results;
    } catch (error) {
      console.error('Error fetching all deployments for NexusAI:', error);
      return [];
    }
  }

  /**
   * Get all cloud accounts for a tenant
   */
  async getCloudAccounts(tenantId: string): Promise<CloudAccount[]> {
    try {
      return await cmpService.getCloudAccounts(tenantId);
    } catch (error) {
      console.error(`Error fetching cloud accounts for tenant ${tenantId} for NexusAI:`, error);
      return [];
    }
  }

  /**
   * Get all cloud accounts across all tenants
   */
  async getAllCloudAccounts(): Promise<{ tenant: Tenant; accounts: CloudAccount[] }[]> {
    try {
      const tenants = await this.getTenants();
      const results = await Promise.all(
        tenants.map(async (tenant) => {
          const accounts = await this.getCloudAccounts(tenant.tenant_id);
          return { tenant, accounts };
        })
      );
      return results;
    } catch (error) {
      console.error('Error fetching all cloud accounts for NexusAI:', error);
      return [];
    }
  }

  /**
   * Get all templates for a tenant
   */
  async getTemplates(tenantId: string): Promise<CloudTemplate[]> {
    try {
      return await cmpService.getTemplates(tenantId);
    } catch (error) {
      console.error(`Error fetching templates for tenant ${tenantId} for NexusAI:`, error);
      return [];
    }
  }

  /**
   * Get all templates across all tenants
   */
  async getAllTemplates(): Promise<{ tenant: Tenant; templates: CloudTemplate[] }[]> {
    try {
      const tenants = await this.getTenants();
      const results = await Promise.all(
        tenants.map(async (tenant) => {
          const templates = await this.getTemplates(tenant.tenant_id);
          return { tenant, templates };
        })
      );
      return results;
    } catch (error) {
      console.error('Error fetching all templates for NexusAI:', error);
      return [];
    }
  }

  /**
   * Get all environments for a tenant
   */
  async getEnvironments(tenantId: string): Promise<any[]> {
    try {
      return await cmpService.getEnvironments(tenantId);
    } catch (error) {
      console.error(`Error fetching environments for tenant ${tenantId} for NexusAI:`, error);
      return [];
    }
  }

  /**
   * Get all environments across all tenants
   */
  async getAllEnvironments(): Promise<{ tenant: Tenant; environments: any[] }[]> {
    try {
      const tenants = await this.getTenants();
      const results = await Promise.all(
        tenants.map(async (tenant) => {
          const environments = await this.getEnvironments(tenant.tenant_id);
          return { tenant, environments };
        })
      );
      return results;
    } catch (error) {
      console.error('Error fetching all environments for NexusAI:', error);
      return [];
    }
  }

  /**
   * Get all users for a tenant
   */
  async getUsers(tenantId: string): Promise<User[]> {
    try {
      return await cmpService.getUsers(tenantId);
    } catch (error) {
      console.error(`Error fetching users for tenant ${tenantId} for NexusAI:`, error);
      return [];
    }
  }

  /**
   * Get all users across all tenants
   */
  async getAllUsers(): Promise<{ tenant: Tenant; users: User[] }[]> {
    try {
      const tenants = await this.getTenants();
      const results = await Promise.all(
        tenants.map(async (tenant) => {
          const users = await this.getUsers(tenant.tenant_id);
          return { tenant, users };
        })
      );
      return results;
    } catch (error) {
      console.error('Error fetching all users for NexusAI:', error);
      return [];
    }
  }

  /**
   * Get all template foundry items
   */
  async getTemplateFoundry(tenantId: string): Promise<any[]> {
    try {
      return await cmpService.getTemplateFoundry(tenantId);
    } catch (error) {
      console.error(`Error fetching template foundry for tenant ${tenantId} for NexusAI:`, error);
      return [];
    }
  }

  /**
   * Get all template foundry items across all tenants
   */
  async getAllTemplateFoundry(): Promise<{ tenant: Tenant; templates: any[] }[]> {
    try {
      const tenants = await this.getTenants();
      const results = await Promise.all(
        tenants.map(async (tenant) => {
          const templates = await this.getTemplateFoundry(tenant.tenant_id);
          return { tenant, templates };
        })
      );
      return results;
    } catch (error) {
      console.error('Error fetching all template foundry items for NexusAI:', error);
      return [];
    }
  }

  /**
   * Get platform statistics
   */
  async getPlatformStats(): Promise<{
    tenantCount: number;
    deploymentCount: number;
    cloudAccountCount: number;
    templateCount: number;
    userCount: number;
    environmentCount: number;
    providerStats: {
      azure: number;
      aws: number;
      gcp: number;
    };
  }> {
    try {
      const allTenants = await this.getTenants();
      const allDeployments = await this.getAllDeployments();
      const allCloudAccounts = await this.getAllCloudAccounts();
      const allTemplates = await this.getAllTemplates();
      const allUsers = await this.getAllUsers();
      const allEnvironments = await this.getAllEnvironments();

      // Count total deployments
      const deploymentCount = allDeployments.reduce(
        (total, item) => total + item.deployments.length,
        0
      );

      // Count total cloud accounts
      const cloudAccountCount = allCloudAccounts.reduce(
        (total, item) => total + item.accounts.length,
        0
      );

      // Count accounts by provider
      const providerStats = {
        azure: 0,
        aws: 0,
        gcp: 0,
      };

      allCloudAccounts.forEach((item) => {
        item.accounts.forEach((account) => {
          if (account.provider === 'azure') providerStats.azure++;
          else if (account.provider === 'aws') providerStats.aws++;
          else if (account.provider === 'gcp') providerStats.gcp++;
        });
      });

      // Count total templates
      const templateCount = allTemplates.reduce(
        (total, item) => total + item.templates.length,
        0
      );

      // Count total users
      const userCount = allUsers.reduce(
        (total, item) => total + item.users.length,
        0
      );

      // Count total environments
      const environmentCount = allEnvironments.reduce(
        (total, item) => total + item.environments.length,
        0
      );

      return {
        tenantCount: allTenants.length,
        deploymentCount,
        cloudAccountCount,
        templateCount,
        userCount,
        environmentCount,
        providerStats,
      };
    } catch (error) {
      console.error('Error fetching platform stats for NexusAI:', error);
      return {
        tenantCount: 0,
        deploymentCount: 0,
        cloudAccountCount: 0,
        templateCount: 0,
        userCount: 0,
        environmentCount: 0,
        providerStats: {
          azure: 0,
          aws: 0,
          gcp: 0,
        },
      };
    }
  }

  /**
   * Get user role statistics
   */
  async getUserRoleStats(): Promise<{
    admin: number;
    user: number;
    msp: number;
  }> {
    try {
      const allUsers = await this.getAllUsers();
      const roleStats = {
        admin: 0,
        user: 0,
        msp: 0,
      };

      allUsers.forEach((item) => {
        item.users.forEach((user) => {
          if (user.role === 'admin') roleStats.admin++;
          else if (user.role === 'user') roleStats.user++;
          else if (user.role === 'msp') roleStats.msp++;
        });
      });

      return roleStats;
    } catch (error) {
      console.error('Error fetching user role stats for NexusAI:', error);
      return {
        admin: 0,
        user: 0,
        msp: 0,
      };
    }
  }

  /**
   * Get deployment statistics by tenant
   */
  async getDeploymentStatsByTenant(): Promise<{
    tenantName: string;
    deploymentCount: number;
  }[]> {
    try {
      const allDeployments = await this.getAllDeployments();
      return allDeployments.map((item) => ({
        tenantName: item.tenant.name,
        deploymentCount: item.deployments.length,
      }));
    } catch (error) {
      console.error('Error fetching deployment stats by tenant for NexusAI:', error);
      return [];
    }
  }

  /**
   * Get cloud account statistics by provider
   */
  async getCloudAccountStatsByProvider(): Promise<{
    provider: string;
    count: number;
  }[]> {
    try {
      const allCloudAccounts = await this.getAllCloudAccounts();
      const providerCounts: Record<string, number> = {};

      allCloudAccounts.forEach((item) => {
        item.accounts.forEach((account) => {
          const provider = account.provider;
          providerCounts[provider] = (providerCounts[provider] || 0) + 1;
        });
      });

      return Object.entries(providerCounts).map(([provider, count]) => ({
        provider,
        count,
      }));
    } catch (error) {
      console.error('Error fetching cloud account stats by provider for NexusAI:', error);
      return [];
    }
  }

  /**
   * Get template usage statistics
   */
  async getTemplateUsageStats(): Promise<{
    name: string;
    count: number;
    tenants: string[];
  }[]> {
    try {
      const allTemplates = await this.getAllTemplates();
      const templateUsage: Record<string, { count: number; tenants: string[] }> = {};
      
      // Count template usage across all tenants
      allTemplates.forEach(({ tenant, templates }) => {
        templates.forEach(template => {
          const templateName = template.name;
          if (!templateUsage[templateName]) {
            templateUsage[templateName] = { count: 0, tenants: [] };
          }
          templateUsage[templateName].count++;
          if (!templateUsage[templateName].tenants.includes(tenant.name)) {
            templateUsage[templateName].tenants.push(tenant.name);
          }
        });
      });
      
      // Sort templates by usage
      return Object.entries(templateUsage)
        .sort((a, b) => b[1].count - a[1].count)
        .map(([name, data]) => ({
          name,
          count: data.count,
          tenants: data.tenants
        }));
    } catch (error) {
      console.error('Error fetching template usage stats for NexusAI:', error);
      return [];
    }
  }
}

// Create a singleton instance
export const nexusAIPlatformService = new NexusAIPlatformService();

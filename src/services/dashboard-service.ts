import axios from 'axios';

// API base URL for backend services
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

// Types for dashboard entities
export interface DashboardWidget {
  id: number;
  widget_id: string;
  name: string;
  description?: string;
  widget_type: string;
  category: string;
  default_config?: any;
  data_source: string;
  refresh_interval: number;
  is_active: boolean;
}

export interface UserWidget {
  id: number;
  user_widget_id: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  custom_title?: string;
  custom_config?: any;
  is_visible: boolean;
  dashboard_widget: DashboardWidget;
}

export interface Dashboard {
  id: number;
  dashboard_id: string;
  name: string;
  description?: string;
  is_default: boolean;
  layout_config?: any;
  user_widgets: UserWidget[];
}

export interface CreateDashboardRequest {
  name: string;
  description?: string;
  is_default?: boolean;
  layout_config?: any;
}

export interface UpdateDashboardRequest {
  name?: string;
  description?: string;
  is_default?: boolean;
  layout_config?: any;
}

export interface CreateUserWidgetRequest {
  dashboard_widget_id: number;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
  custom_title?: string;
  custom_config?: any;
  is_visible?: boolean;
}

export interface UpdateUserWidgetRequest {
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
  custom_title?: string;
  custom_config?: any;
  is_visible?: boolean;
}

export interface DashboardStats {
  deployments: {
    total: number;
    running: number;
    failed: number;
    pending: number;
    by_provider: Record<string, number>;
    recent: any[];
  };
  cloud_accounts: {
    total: number;
    connected: number;
    warning: number;
    error: number;
    by_provider: Record<string, number>;
  };
  templates: {
    total: number;
    by_category: Record<string, number>;
    by_provider: Record<string, number>;
  };
}

export class DashboardService {
  /**
   * Get authentication headers
   */
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * Get all available dashboard widgets
   */
  async getAvailableWidgets(category?: string): Promise<DashboardWidget[]> {
    try {
      const response = await api.get('/dashboards/available-widgets', {
        headers: this.getAuthHeaders(),
        params: category ? { category } : {}
      });
      return response.data;
    } catch (error) {
      console.error('Get available widgets error:', error);
      throw error;
    }
  }

  /**
   * Get all dashboards for the current user
   */
  async getUserDashboards(): Promise<Dashboard[]> {
    try {
      const response = await api.get('/dashboards', {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Get user dashboards error:', error);
      throw error;
    }
  }

  /**
   * Get a specific dashboard by ID
   */
  async getDashboard(dashboardId: string): Promise<Dashboard> {
    try {
      const response = await api.get(`/dashboards/${dashboardId}`, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error(`Get dashboard ${dashboardId} error:`, error);
      throw error;
    }
  }

  /**
   * Create a new dashboard
   */
  async createDashboard(dashboardData: CreateDashboardRequest): Promise<Dashboard> {
    try {
      const response = await api.post('/dashboards', dashboardData, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error('Create dashboard error:', error);
      throw error;
    }
  }

  /**
   * Update a dashboard
   */
  async updateDashboard(dashboardId: string, dashboardData: UpdateDashboardRequest): Promise<Dashboard> {
    try {
      const response = await api.put(`/dashboards/${dashboardId}`, dashboardData, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error(`Update dashboard ${dashboardId} error:`, error);
      throw error;
    }
  }

  /**
   * Delete a dashboard
   */
  async deleteDashboard(dashboardId: string): Promise<void> {
    try {
      await api.delete(`/dashboards/${dashboardId}`, {
        headers: this.getAuthHeaders()
      });
    } catch (error) {
      console.error(`Delete dashboard ${dashboardId} error:`, error);
      throw error;
    }
  }

  /**
   * Add a widget to a dashboard
   */
  async addWidgetToDashboard(dashboardId: string, widgetData: CreateUserWidgetRequest): Promise<UserWidget> {
    try {
      const response = await api.post(`/dashboards/${dashboardId}/widgets`, widgetData, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error(`Add widget to dashboard ${dashboardId} error:`, error);
      throw error;
    }
  }

  /**
   * Update a widget in a dashboard
   */
  async updateDashboardWidget(
    dashboardId: string, 
    userWidgetId: string, 
    widgetData: UpdateUserWidgetRequest
  ): Promise<UserWidget> {
    try {
      const response = await api.put(`/dashboards/${dashboardId}/widgets/${userWidgetId}`, widgetData, {
        headers: this.getAuthHeaders()
      });
      return response.data;
    } catch (error) {
      console.error(`Update widget ${userWidgetId} in dashboard ${dashboardId} error:`, error);
      throw error;
    }
  }

  /**
   * Remove a widget from a dashboard
   */
  async removeWidgetFromDashboard(dashboardId: string, userWidgetId: string): Promise<void> {
    try {
      await api.delete(`/dashboards/${dashboardId}/widgets/${userWidgetId}`, {
        headers: this.getAuthHeaders()
      });
    } catch (error) {
      console.error(`Remove widget ${userWidgetId} from dashboard ${dashboardId} error:`, error);
      throw error;
    }
  }

  /**
   * Get dashboard statistics for widgets
   */
  async getDashboardStats(tenantId?: string): Promise<DashboardStats> {
    try {
      const [deploymentsStats, cloudAccountsStats, templatesStats] = await Promise.all([
        api.get('/dashboards/stats/deployments', {
          headers: this.getAuthHeaders(),
          params: tenantId ? { tenant_id: tenantId } : {}
        }),
        api.get('/dashboards/stats/cloud-accounts', {
          headers: this.getAuthHeaders(),
          params: tenantId ? { tenant_id: tenantId } : {}
        }),
        api.get('/dashboards/stats/templates', {
          headers: this.getAuthHeaders(),
          params: tenantId ? { tenant_id: tenantId } : {}
        })
      ]);

      return {
        deployments: deploymentsStats.data,
        cloud_accounts: cloudAccountsStats.data,
        templates: templatesStats.data
      };
    } catch (error) {
      console.error('Get dashboard stats error:', error);
      throw error;
    }
  }

  /**
   * Refresh widget data based on its data source
   */
  async refreshWidgetData(widget: DashboardWidget, tenantId?: string): Promise<any> {
    try {
      // Map data source to appropriate API call
      switch (widget.data_source) {
        case '/api/deployments/stats':
          return (await api.get('/dashboards/stats/deployments', {
            headers: this.getAuthHeaders(),
            params: tenantId ? { tenant_id: tenantId } : {}
          })).data;
        
        case '/api/cloud-accounts/stats':
          return (await api.get('/dashboards/stats/cloud-accounts', {
            headers: this.getAuthHeaders(),
            params: tenantId ? { tenant_id: tenantId } : {}
          })).data;
        
        case '/api/templates/stats':
          return (await api.get('/dashboards/stats/templates', {
            headers: this.getAuthHeaders(),
            params: tenantId ? { tenant_id: tenantId } : {}
          })).data;
        
        default:
          // For other data sources, try to call them directly
          return (await api.get(widget.data_source, {
            headers: this.getAuthHeaders(),
            params: tenantId ? { tenant_id: tenantId } : {}
          })).data;
      }
    } catch (error) {
      console.error(`Refresh widget data for ${widget.name} error:`, error);
      throw error;
    }
  }
}

// Create a singleton instance
export const dashboardService = new DashboardService();


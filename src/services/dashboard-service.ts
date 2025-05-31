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

// Add request interceptor to include auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Types
export interface Dashboard {
  id: number;
  dashboard_id: string;
  name: string;
  description?: string;
  is_default: boolean;
  is_active: boolean;
  layout_config?: any;
  tenant_id: string;
  created_by_id: string;
  created_at: string;
  updated_at: string;
  widgets: DashboardWidget[];
}

export interface DashboardListItem {
  id: number;
  dashboard_id: string;
  name: string;
  description?: string;
  is_default: boolean;
  is_active: boolean;
  widget_count: number;
  created_at: string;
  updated_at: string;
}

export interface DashboardWidget {
  id: number;
  widget_id: string;
  title: string;
  widget_type: string;
  data_source: string;
  configuration?: any;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  is_active: boolean;
  refresh_interval: number;
  dashboard_id: string;
  created_at: string;
  updated_at: string;
}

export interface WidgetType {
  id: number;
  type_name: string;
  display_name: string;
  description?: string;
  icon?: string;
  category?: string;
  default_config?: any;
  data_sources?: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WidgetData {
  data: any;
  last_updated: string;
  next_refresh?: string;
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
  is_active?: boolean;
}

export interface CreateWidgetRequest {
  title: string;
  widget_type: string;
  data_source: string;
  configuration?: any;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
  refresh_interval?: number;
}

export interface UpdateWidgetRequest {
  title?: string;
  widget_type?: string;
  data_source?: string;
  configuration?: any;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
  refresh_interval?: number;
  is_active?: boolean;
}

export interface WidgetDataRequest {
  widget_type: string;
  data_source: string;
  configuration?: any;
  tenant_id: string;
}

class DashboardService {
  // Dashboard CRUD operations
  async getDashboards(skip: number = 0, limit: number = 100): Promise<DashboardListItem[]> {
    try {
      const response = await api.get(`/dashboards?skip=${skip}&limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching dashboards:', error);
      throw error;
    }
  }

  async getDashboard(dashboardId: string): Promise<Dashboard> {
    try {
      const response = await api.get(`/dashboards/${dashboardId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      throw error;
    }
  }

  async createDashboard(dashboardData: CreateDashboardRequest): Promise<Dashboard> {
    try {
      const response = await api.post('/dashboards', dashboardData);
      return response.data;
    } catch (error) {
      console.error('Error creating dashboard:', error);
      throw error;
    }
  }

  async updateDashboard(dashboardId: string, dashboardData: UpdateDashboardRequest): Promise<Dashboard> {
    try {
      const response = await api.put(`/dashboards/${dashboardId}`, dashboardData);
      return response.data;
    } catch (error) {
      console.error('Error updating dashboard:', error);
      throw error;
    }
  }

  async deleteDashboard(dashboardId: string): Promise<void> {
    try {
      await api.delete(`/dashboards/${dashboardId}`);
    } catch (error) {
      console.error('Error deleting dashboard:', error);
      throw error;
    }
  }

  // Widget CRUD operations
  async getDashboardWidgets(dashboardId: string): Promise<DashboardWidget[]> {
    try {
      const response = await api.get(`/dashboards/${dashboardId}/widgets`);
      return response.data;
    } catch (error) {
      console.error('Error fetching dashboard widgets:', error);
      throw error;
    }
  }

  async createWidget(dashboardId: string, widgetData: CreateWidgetRequest): Promise<DashboardWidget> {
    try {
      const response = await api.post(`/dashboards/${dashboardId}/widgets`, widgetData);
      return response.data;
    } catch (error) {
      console.error('Error creating widget:', error);
      throw error;
    }
  }

  async updateWidget(dashboardId: string, widgetId: string, widgetData: UpdateWidgetRequest): Promise<DashboardWidget> {
    try {
      const response = await api.put(`/dashboards/${dashboardId}/widgets/${widgetId}`, widgetData);
      return response.data;
    } catch (error) {
      console.error('Error updating widget:', error);
      throw error;
    }
  }

  async deleteWidget(dashboardId: string, widgetId: string): Promise<void> {
    try {
      await api.delete(`/dashboards/${dashboardId}/widgets/${widgetId}`);
    } catch (error) {
      console.error('Error deleting widget:', error);
      throw error;
    }
  }

  // Widget types and data
  async getWidgetTypes(category?: string): Promise<WidgetType[]> {
    try {
      const params = category ? `?category=${category}` : '';
      const response = await api.get(`/dashboards/widget-types${params}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching widget types:', error);
      throw error;
    }
  }

  async getWidgetData(request: WidgetDataRequest): Promise<WidgetData> {
    try {
      const response = await api.post('/dashboards/widget-data', request);
      return response.data;
    } catch (error) {
      console.error('Error fetching widget data:', error);
      throw error;
    }
  }

  // Utility methods
  async getDefaultDashboard(): Promise<Dashboard | null> {
    try {
      const dashboards = await this.getDashboards();
      const defaultDashboard = dashboards.find(d => d.is_default);
      
      if (defaultDashboard) {
        return await this.getDashboard(defaultDashboard.dashboard_id);
      }
      
      // If no default dashboard, return the first one
      if (dashboards.length > 0) {
        return await this.getDashboard(dashboards[0].dashboard_id);
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching default dashboard:', error);
      throw error;
    }
  }

  async setDefaultDashboard(dashboardId: string): Promise<Dashboard> {
    try {
      return await this.updateDashboard(dashboardId, { is_default: true });
    } catch (error) {
      console.error('Error setting default dashboard:', error);
      throw error;
    }
  }
}

export const dashboardService = new DashboardService();

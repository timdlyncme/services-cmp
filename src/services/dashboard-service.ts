import axios from 'axios';
import { API_BASE_URL } from '@/config/api';

export interface Dashboard {
  dashboard_id: string;
  name: string;
  description?: string;
  is_default: boolean;
  layout_config?: any;
  is_active: boolean;
  date_created: string;
  date_modified: string;
  user_id: string;
}

export interface DashboardWidget {
  widget_id: string;
  name: string;
  description?: string;
  widget_type: 'platform_stats' | 'visual' | 'text' | 'status';
  category: 'statistics' | 'charts' | 'monitoring' | 'information';
  default_config?: any;
  data_source?: string;
  min_width: number;
  min_height: number;
  max_width?: number;
  max_height?: number;
  is_active: boolean;
  date_created: string;
  date_modified: string;
}

export interface UserWidget {
  user_widget_id: string;
  custom_name?: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  custom_config?: any;
  is_visible: boolean;
  dashboard_id: string;
  widget_id: string;
  date_created: string;
  date_modified: string;
  widget_template: DashboardWidget;
}

export interface DashboardWithWidgets extends Dashboard {
  user_widgets: UserWidget[];
}

export interface WidgetData {
  widget_type: string;
  data: any;
  last_updated: string;
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
  dashboard_id: string;
  widget_id: string;
  custom_name?: string;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
  custom_config?: any;
  is_visible?: boolean;
}

export interface UpdateUserWidgetRequest {
  custom_name?: string;
  position_x?: number;
  position_y?: number;
  width?: number;
  height?: number;
  custom_config?: any;
  is_visible?: boolean;
}

export interface DashboardLayoutUpdate {
  layout_config: any;
  widgets: Array<{
    user_widget_id: string;
    position_x?: number;
    position_y?: number;
    width?: number;
    height?: number;
    is_visible?: boolean;
  }>;
}

class DashboardService {
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  // Dashboard CRUD operations
  async getDashboards(): Promise<Dashboard[]> {
    const response = await axios.get(`${API_BASE_URL}/dashboards/`, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async getDashboard(dashboardId: string): Promise<DashboardWithWidgets> {
    const response = await axios.get(`${API_BASE_URL}/dashboards/${dashboardId}`, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async createDashboard(dashboard: CreateDashboardRequest): Promise<Dashboard> {
    const response = await axios.post(`${API_BASE_URL}/dashboards/`, dashboard, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async updateDashboard(dashboardId: string, dashboard: UpdateDashboardRequest): Promise<Dashboard> {
    const response = await axios.put(`${API_BASE_URL}/dashboards/${dashboardId}`, dashboard, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async deleteDashboard(dashboardId: string): Promise<void> {
    await axios.delete(`${API_BASE_URL}/dashboards/${dashboardId}`, {
      headers: this.getAuthHeaders(),
    });
  }

  // Widget template operations
  async getWidgetTemplates(category?: string, widgetType?: string): Promise<DashboardWidget[]> {
    const params = new URLSearchParams();
    if (category) params.append('category', category);
    if (widgetType) params.append('widget_type', widgetType);
    
    const response = await axios.get(`${API_BASE_URL}/dashboards/widgets/templates?${params}`, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  // User widget operations
  async addWidgetToDashboard(dashboardId: string, widget: CreateUserWidgetRequest): Promise<UserWidget> {
    const response = await axios.post(`${API_BASE_URL}/dashboards/${dashboardId}/widgets`, widget, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async updateUserWidget(userWidgetId: string, widget: UpdateUserWidgetRequest): Promise<UserWidget> {
    const response = await axios.put(`${API_BASE_URL}/dashboards/widgets/${userWidgetId}`, widget, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  async removeWidgetFromDashboard(userWidgetId: string): Promise<void> {
    await axios.delete(`${API_BASE_URL}/dashboards/widgets/${userWidgetId}`, {
      headers: this.getAuthHeaders(),
    });
  }

  // Layout operations
  async updateDashboardLayout(dashboardId: string, layout: DashboardLayoutUpdate): Promise<DashboardWithWidgets> {
    const response = await axios.put(`${API_BASE_URL}/dashboards/${dashboardId}/layout`, layout, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  // Widget data operations
  async getWidgetData(widgetType: string, dataSource: string, config?: any, tenantId?: string): Promise<WidgetData> {
    const request = {
      widget_type: widgetType,
      data_source: dataSource,
      config,
      tenant_id: tenantId,
    };

    const response = await axios.post(`${API_BASE_URL}/widgets/data`, request, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }

  // Dashboard statistics
  async getDashboardStats(): Promise<any> {
    const response = await axios.get(`${API_BASE_URL}/dashboards/stats/overview`, {
      headers: this.getAuthHeaders(),
    });
    return response.data;
  }
}

export const dashboardService = new DashboardService();


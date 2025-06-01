import axios from 'axios';
import { 
  Dashboard, 
  DashboardWidget, 
  UserWidget, 
  WidgetData,
  DashboardCreateRequest,
  DashboardUpdateRequest,
  UserWidgetCreateRequest,
  UserWidgetUpdateRequest,
  GridLayout
} from '@/types/dashboard';

// API base URL
const API_BASE = '/api/dashboards';

class DashboardService {
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };
  }

  // Dashboard operations
  async getDashboards(): Promise<Dashboard[]> {
    const response = await axios.get(`${API_BASE}`, this.getAuthHeaders());
    return response.data;
  }

  async getDashboard(dashboardId: string): Promise<Dashboard> {
    const response = await axios.get(`${API_BASE}/${dashboardId}`, this.getAuthHeaders());
    return response.data;
  }

  async createDashboard(data: DashboardCreateRequest): Promise<Dashboard> {
    const response = await axios.post(`${API_BASE}`, data, this.getAuthHeaders());
    return response.data;
  }

  async updateDashboard(dashboardId: string, data: DashboardUpdateRequest): Promise<Dashboard> {
    const response = await axios.put(`${API_BASE}/${dashboardId}`, data, this.getAuthHeaders());
    return response.data;
  }

  async deleteDashboard(dashboardId: string): Promise<void> {
    await axios.delete(`${API_BASE}/${dashboardId}`, this.getAuthHeaders());
  }

  async updateDashboardLayout(dashboardId: string, layout: GridLayout[]): Promise<void> {
    await axios.post(`${API_BASE}/${dashboardId}/layout`, layout, this.getAuthHeaders());
  }

  // Widget catalog operations
  async getWidgetCatalog(category?: string): Promise<DashboardWidget[]> {
    const params = category ? { category } : {};
    const response = await axios.get(`${API_BASE}/widget-catalog`, {
      ...this.getAuthHeaders(),
      params,
    });
    return response.data;
  }

  // User widget operations
  async addWidgetToDashboard(dashboardId: string, data: UserWidgetCreateRequest): Promise<UserWidget> {
    const response = await axios.post(`${API_BASE}/${dashboardId}/widgets`, data, this.getAuthHeaders());
    return response.data;
  }

  async updateUserWidget(userWidgetId: string, data: UserWidgetUpdateRequest): Promise<UserWidget> {
    const response = await axios.put(`${API_BASE}/user-widgets/${userWidgetId}`, data, this.getAuthHeaders());
    return response.data;
  }

  async removeUserWidget(userWidgetId: string): Promise<void> {
    await axios.delete(`${API_BASE}/user-widgets/${userWidgetId}`, this.getAuthHeaders());
  }

  // Widget data operations
  async getWidgetData(dataSource: string, filters?: Record<string, any>): Promise<WidgetData> {
    const params = filters ? { filters: JSON.stringify(filters) } : {};
    const response = await axios.get(`${API_BASE}/widget-data/${dataSource}`, {
      ...this.getAuthHeaders(),
      params,
    });
    return response.data;
  }

  // Utility methods
  generateDefaultLayout(widgets: UserWidget[]): GridLayout[] {
    return widgets.map((widget, index) => {
      const defaultSize = widget.widget.default_size || { w: 4, h: 3 };
      const cols = 12; // Assuming 12-column grid
      const x = (index * defaultSize.w) % cols;
      const y = Math.floor((index * defaultSize.w) / cols) * defaultSize.h;

      return {
        i: widget.user_widget_id,
        x,
        y,
        w: defaultSize.w,
        h: defaultSize.h,
        minW: 2,
        minH: 2,
      };
    });
  }

  getIconComponent(iconName?: string) {
    // Map icon names to actual icon components
    const iconMap: Record<string, string> = {
      'Database': 'Database',
      'CheckCircle2': 'CheckCircle2',
      'AlertCircle': 'AlertCircle',
      'CloudCog': 'CloudCog',
      'PieChart': 'PieChart',
      'TrendingUp': 'TrendingUp',
      'List': 'List',
      'Server': 'Server',
      'BarChart3': 'BarChart3',
      'FileText': 'FileText',
    };

    return iconMap[iconName || ''] || 'Square';
  }
}

export const dashboardService = new DashboardService();

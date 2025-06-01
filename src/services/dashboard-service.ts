import { Dashboard, DashboardWidget, UserWidget, DashboardWithWidgets } from '@/types/dashboard';

// Use axios like other services
import axios from 'axios';

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

class DashboardService {
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    console.log('Dashboard Service - Token from localStorage:', token ? 'Token exists' : 'No token found');
    console.log('Dashboard Service - Token length:', token ? token.length : 0);
    console.log('Dashboard Service - Token preview:', token ? `${token.substring(0, 20)}...` : 'No token');
    
    return {
      Authorization: `Bearer ${token}`,
    };
  }

  // Dashboard CRUD operations
  async getDashboards(): Promise<Dashboard[]> {
    try {
      console.log('Dashboard Service - Making request to /dashboards/');
      const headers = this.getAuthHeaders();
      console.log('Dashboard Service - Request headers:', headers);
      
      const response = await api.get('/dashboards/', {
        headers,
      });

      console.log('Dashboard Service - Response status:', response.status);
      console.log('Dashboard Service - Response data:', response.data);

      const data = response.data;
      console.log('Dashboard Service - Data type:', typeof data);
      console.log('Dashboard Service - Is array:', Array.isArray(data));
      console.log('Dashboard Service - Data length:', data?.length);
      
      // Ensure we return an array
      if (!Array.isArray(data)) {
        console.warn('Dashboard Service - Response is not an array, wrapping in array');
        return [];
      }
      
      return data;
    } catch (error) {
      console.error('Dashboard Service - Error in getDashboards:', error);
      throw new Error('Failed to fetch dashboards');
    }
  }

  async getDashboard(dashboardId: string): Promise<DashboardWithWidgets> {
    try {
      console.log('Dashboard Service - Getting dashboard with ID:', dashboardId);
      
      const response = await api.get(`/dashboards/${dashboardId}`, {
        headers: this.getAuthHeaders(),
      });

      console.log('Dashboard Service - getDashboard response status:', response.status);
      console.log('Dashboard Service - getDashboard response data:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('Dashboard Service - Error in getDashboard:', error);
      throw error;
    }
  }

  async createDashboard(data: {
    name: string;
    description: string;
    is_default: boolean;
  }): Promise<Dashboard> {
    try {
      console.log('Dashboard Service - Creating dashboard with data:', data);
      const headers = this.getAuthHeaders();
      console.log('Dashboard Service - Create request headers:', headers);
      
      const response = await api.post('/dashboards/', data, {
        headers,
      });

      console.log('Dashboard Service - Create dashboard response status:', response.status);
      console.log('Dashboard Service - Created dashboard:', response.data);
      
      return response.data;
    } catch (error) {
      console.error('Dashboard Service - Error in createDashboard:', error);
      throw error;
    }
  }

  async updateDashboard(
    dashboardId: string,
    data: {
      name?: string;
      description?: string;
      is_default?: boolean;
      layout?: any;
    }
  ): Promise<Dashboard> {
    const response = await api.put(`${API_URL}/dashboards/${dashboardId}`, {
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to update dashboard');
    }

    return response.json();
  }

  async deleteDashboard(dashboardId: string): Promise<void> {
    const response = await api.delete(`${API_URL}/dashboards/${dashboardId}`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to delete dashboard');
    }
  }

  // Widget catalog operations
  async getWidgetCatalog(category?: string): Promise<DashboardWidget[]> {
    const url = category 
      ? `${API_URL}/dashboards/widgets/catalog?category=${category}`
      : `${API_URL}/dashboards/widgets/catalog`;

    const response = await api.get(url, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch widget catalog');
    }

    return response.json();
  }

  // User widget operations
  async addWidgetToDashboard(
    dashboardId: string,
    data: {
      widget_id: string;
      custom_name?: string;
      position_x?: number;
      position_y?: number;
      width?: number;
      height?: number;
      custom_config?: any;
    }
  ): Promise<UserWidget> {
    const response = await api.post(`${API_URL}/dashboards/${dashboardId}/widgets`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to add widget to dashboard');
    }

    return response.json();
  }

  async updateWidget(
    dashboardId: string,
    userWidgetId: string,
    data: {
      custom_name?: string;
      position_x?: number;
      position_y?: number;
      width?: number;
      height?: number;
      custom_config?: any;
      is_visible?: boolean;
    }
  ): Promise<UserWidget> {
    const response = await api.put(`${API_URL}/dashboards/${dashboardId}/widgets/${userWidgetId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to update widget');
    }

    return response.json();
  }

  async removeWidgetFromDashboard(
    dashboardId: string,
    userWidgetId: string
  ): Promise<void> {
    const response = await api.delete(`${API_URL}/dashboards/${dashboardId}/widgets/${userWidgetId}`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to remove widget from dashboard');
    }
  }

  async bulkUpdateWidgetPositions(
    dashboardId: string,
    widgets: Array<{
      user_widget_id: string;
      position_x?: number;
      position_y?: number;
      width?: number;
      height?: number;
    }>
  ): Promise<void> {
    const response = await api.post(`${API_URL}/dashboards/${dashboardId}/widgets/bulk-update`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(widgets),
    });

    if (!response.ok) {
      throw new Error('Failed to update widget positions');
    }
  }

  // Widget data operations
  async getWidgetData(dataSource: string): Promise<any> {
    const response = await api.get(`${API_URL}/widget-data/${dataSource}`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch widget data');
    }

    return response.json();
  }
}

export const dashboardService = new DashboardService();

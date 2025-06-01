import { Dashboard, DashboardWithWidgets, DashboardWidget, UserWidget } from "@/components/dashboard/widget-types";

const API_BASE = '/api';

class DashboardService {
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    console.log('Dashboard Service - Token from localStorage:', token ? 'Token exists' : 'No token found');
    console.log('Dashboard Service - Token length:', token ? token.length : 0);
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  // Dashboard CRUD operations
  async getDashboards(): Promise<Dashboard[]> {
    try {
      console.log('Dashboard Service - Making request to /api/dashboards/');
      const headers = this.getAuthHeaders();
      console.log('Dashboard Service - Request headers:', headers);
      
      const response = await fetch('/api/dashboards/', {
        method: 'GET',
        headers,
      });

      console.log('Dashboard Service - Response status:', response.status);
      console.log('Dashboard Service - Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Dashboard Service - Error response:', errorText);
        throw new Error(`Failed to fetch dashboards: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Dashboard Service - Response data:', data);
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
      
      const response = await fetch(`/api/dashboards/${dashboardId}`, {
        headers: this.getAuthHeaders(),
      });

      console.log('Dashboard Service - getDashboard response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Dashboard Service - getDashboard error response:', errorText);
        throw new Error(`Failed to fetch dashboard: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Dashboard Service - getDashboard response data:', data);
      
      return data;
    } catch (error) {
      console.error('Dashboard Service - Error in getDashboard:', error);
      throw error;
    }
  }

  async createDashboard(data: {
    name: string;
    description?: string;
    is_default?: boolean;
  }): Promise<Dashboard> {
    const response = await fetch(`${API_BASE}/dashboards`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to create dashboard');
    }

    return response.json();
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
    const response = await fetch(`${API_BASE}/dashboards/${dashboardId}`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to update dashboard');
    }

    return response.json();
  }

  async deleteDashboard(dashboardId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/dashboards/${dashboardId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to delete dashboard');
    }
  }

  // Widget catalog operations
  async getWidgetCatalog(category?: string): Promise<DashboardWidget[]> {
    const url = category 
      ? `${API_BASE}/dashboards/widgets/catalog?category=${category}`
      : `${API_BASE}/dashboards/widgets/catalog`;

    const response = await fetch(url, {
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
    const response = await fetch(`${API_BASE}/dashboards/${dashboardId}/widgets`, {
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
    const response = await fetch(`${API_BASE}/dashboards/${dashboardId}/widgets/${userWidgetId}`, {
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
    const response = await fetch(`${API_BASE}/dashboards/${dashboardId}/widgets/${userWidgetId}`, {
      method: 'DELETE',
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
    const response = await fetch(`${API_BASE}/dashboards/${dashboardId}/widgets/bulk-update`, {
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
    const response = await fetch(`${API_BASE}/widget-data/${dataSource}`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch widget data');
    }

    return response.json();
  }
}

export const dashboardService = new DashboardService();

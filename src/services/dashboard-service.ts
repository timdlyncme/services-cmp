import { Dashboard, DashboardWithWidgets, DashboardWidget, UserWidget } from "@/components/dashboard/widget-types";

const API_BASE = '/api';

class DashboardService {
  private getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
  }

  // Dashboard CRUD operations
  async getDashboards(): Promise<Dashboard[]> {
    const response = await fetch(`${API_BASE}/dashboards`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch dashboards');
    }

    return response.json();
  }

  async getDashboard(dashboardId: string): Promise<DashboardWithWidgets> {
    const response = await fetch(`${API_BASE}/dashboards/${dashboardId}`, {
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch dashboard');
    }

    return response.json();
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


export interface Dashboard {
  id: number;
  dashboard_id: string;
  name: string;
  description?: string;
  is_default: boolean;
  layout?: GridLayout[];
  created_at: string;
  updated_at: string;
  user_widgets: UserWidget[];
}

export interface DashboardWidget {
  id: number;
  widget_id: string;
  name: string;
  description?: string;
  category?: string;
  widget_type: 'card' | 'chart' | 'table' | 'graph';
  chart_type?: 'bar' | 'line' | 'pie' | 'doughnut';
  data_source: string;
  default_config?: Record<string, any>;
  default_size?: { w: number; h: number };
  icon?: string;
  is_active: boolean;
}

export interface UserWidget {
  id: number;
  user_widget_id: string;
  custom_name?: string;
  custom_config?: Record<string, any>;
  position?: GridLayout;
  color_scheme?: string;
  filters?: Record<string, any>;
  is_visible: boolean;
  widget: DashboardWidget;
}

export interface GridLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export interface WidgetData {
  value?: number;
  label?: string;
  percentage?: number;
  connected?: number;
  data?: any[];
  type?: 'card' | 'pie' | 'line' | 'bar' | 'table' | 'doughnut';
  error?: string;
}

export interface DashboardCreateRequest {
  name: string;
  description?: string;
  is_default?: boolean;
}

export interface DashboardUpdateRequest {
  name?: string;
  description?: string;
  is_default?: boolean;
  layout?: GridLayout[];
}

export interface UserWidgetCreateRequest {
  widget_id: number;
  dashboard_id: number;
  custom_name?: string;
  custom_config?: Record<string, any>;
  position?: GridLayout;
  color_scheme?: string;
  filters?: Record<string, any>;
}

export interface UserWidgetUpdateRequest {
  custom_name?: string;
  custom_config?: Record<string, any>;
  position?: GridLayout;
  color_scheme?: string;
  filters?: Record<string, any>;
  is_visible?: boolean;
}


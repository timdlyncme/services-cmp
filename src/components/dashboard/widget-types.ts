export interface WidgetConfig {
  icon?: string;
  color?: string;
  showLegend?: boolean;
  showTooltip?: boolean;
  timeRange?: string;
  limit?: number;
  showStatus?: boolean;
  [key: string]: any;
}

export interface DashboardWidget {
  id: number;
  widget_id: string;
  name: string;
  description?: string;
  widget_type: 'stat_card' | 'chart' | 'table';
  category: string;
  default_config?: WidgetConfig;
  data_source: string;
  chart_type?: 'pie' | 'line' | 'bar' | 'area' | 'doughnut';
  min_width: number;
  min_height: number;
  default_width: number;
  default_height: number;
}

export interface UserWidget {
  id: number;
  user_widget_id: string;
  custom_name?: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  custom_config?: WidgetConfig;
  is_visible: boolean;
  dashboard_widget: DashboardWidget;
}

export interface Dashboard {
  id: number;
  dashboard_id: string;
  name: string;
  description?: string;
  is_default: boolean;
  layout?: any;
  created_at: string;
  updated_at: string;
}

export interface DashboardWithWidgets {
  dashboard: Dashboard;
  widgets: UserWidget[];
}

export interface WidgetData {
  value?: number;
  label?: string;
  subtitle?: string;
  data?: any[];
  [key: string]: any;
}


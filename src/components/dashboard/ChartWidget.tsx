import React from 'react';
import { BaseWidget } from './BaseWidget';
import { DashboardWidget } from '@/services/dashboard-service';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

interface ChartWidgetProps {
  widget: DashboardWidget;
  data: any;
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export function ChartWidget({
  widget,
  data,
  isLoading,
  error,
  onRefresh,
  onEdit,
  onDelete
}: ChartWidgetProps) {
  const renderChartContent = () => {
    if (!data || !data.chart_data) {
      return (
        <div className="text-center py-4">
          <div className="text-sm text-muted-foreground">No chart data available</div>
        </div>
      );
    }

    const chartType = widget.configuration?.chart_type || 'pie';
    const chartData = Object.entries(data.chart_data).map(([key, value]) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      value: value as number
    }));

    if (chartData.length === 0) {
      return (
        <div className="text-center py-4">
          <div className="text-sm text-muted-foreground">No data to display</div>
        </div>
      );
    }

    if (chartType === 'pie') {
      return (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={60}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (chartType === 'bar') {
      return (
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#8884d8">
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    // Fallback to simple data display
    return (
      <div className="space-y-2">
        {chartData.map((item, index) => (
          <div key={index} className="flex justify-between items-center">
            <span className="text-sm">{item.name}</span>
            <span className="font-medium">{item.value}</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <BaseWidget
      widget={widget}
      isLoading={isLoading}
      error={error}
      onRefresh={onRefresh}
      onEdit={onEdit}
      onDelete={onDelete}
    >
      {renderChartContent()}
    </BaseWidget>
  );
}


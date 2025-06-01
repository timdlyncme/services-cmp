import React from 'react';
import { BaseWidget } from './BaseWidget';
import { UserWidget, WidgetData } from '@/types/dashboard';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ChartWidgetProps {
  userWidget: UserWidget;
  data: WidgetData;
  isLoading?: boolean;
  onRefresh?: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export function ChartWidget({
  userWidget,
  data,
  isLoading = false,
  onRefresh,
  onEdit,
  onRemove,
}: ChartWidgetProps) {
  const chartType = userWidget.widget.chart_type || 'bar';

  const renderChart = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-muted-foreground">Loading chart...</div>
        </div>
      );
    }

    if (!data.data || data.data.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-muted-foreground">No data available</div>
        </div>
      );
    }

    switch (chartType) {
      case 'pie':
      case 'doughnut':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.data}
                cx="50%"
                cy="50%"
                innerRadius={chartType === 'doughnut' ? 40 : 0}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {data.data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#8884d8" />
              {data.data[0]?.cpu && <Bar dataKey="cpu" fill="#82ca9d" />}
              {data.data[0]?.memory && <Bar dataKey="memory" fill="#ffc658" />}
              {data.data[0]?.storage && <Bar dataKey="storage" fill="#ff7300" />}
            </BarChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="running" stroke="#8884d8" />
              <Line type="monotone" dataKey="failed" stroke="#ff7300" />
              <Line type="monotone" dataKey="completed" stroke="#82ca9d" />
              <Line type="monotone" dataKey="pending" stroke="#ffc658" />
            </LineChart>
          </ResponsiveContainer>
        );

      default:
        return (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Unsupported chart type</div>
          </div>
        );
    }
  };

  return (
    <BaseWidget
      userWidget={userWidget}
      isLoading={isLoading}
      onRefresh={onRefresh}
      onEdit={onEdit}
      onRemove={onRemove}
    >
      <div className="h-full">
        {renderChart()}
      </div>
    </BaseWidget>
  );
}


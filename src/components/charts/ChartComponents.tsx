import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
  ResponsiveContainer
} from 'recharts';

interface ChartData {
  name: string;
  value: number;
  [key: string]: any;
}

interface ChartProps {
  data: ChartData[];
  type: 'pie' | 'bar' | 'line';
  width?: number;
  height?: number;
  colors?: string[];
}

const DEFAULT_COLORS = [
  '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#00ff00',
  '#0088fe', '#00c49f', '#ffbb28', '#ff8042', '#8dd1e1'
];

export const PieChartComponent: React.FC<{ data: ChartData[]; colors?: string[] }> = ({ 
  data, 
  colors = DEFAULT_COLORS 
}) => {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
          outerRadius={60}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
};

export const BarChartComponent: React.FC<{ data: ChartData[]; colors?: string[] }> = ({ 
  data, 
  colors = DEFAULT_COLORS 
}) => {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="value" fill={colors[0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};

export const LineChartComponent: React.FC<{ data: ChartData[]; colors?: string[] }> = ({ 
  data, 
  colors = DEFAULT_COLORS 
}) => {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="value" stroke={colors[0]} strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
};

export const ChartRenderer: React.FC<ChartProps> = ({ 
  data, 
  type, 
  colors = DEFAULT_COLORS 
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        No data available
      </div>
    );
  }

  switch (type) {
    case 'pie':
      return <PieChartComponent data={data} colors={colors} />;
    case 'bar':
      return <BarChartComponent data={data} colors={colors} />;
    case 'line':
      return <LineChartComponent data={data} colors={colors} />;
    default:
      return (
        <div className="flex items-center justify-center h-48 text-gray-500">
          Unsupported chart type: {type}
        </div>
      );
  }
};


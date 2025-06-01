import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  RefreshCw,
  MoreVertical,
  Edit,
  Trash2
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  BarChart,
  Bar,
  AreaChart,
  Area
} from "recharts";
import { UserWidget, WidgetData } from "./widget-types";

interface ChartWidgetProps {
  userWidget: UserWidget;
  data: WidgetData | null;
  isLoading: boolean;
  onRefresh: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ChartWidget({ 
  userWidget, 
  data, 
  isLoading, 
  onRefresh, 
  onEdit, 
  onDelete 
}: ChartWidgetProps) {
  const config = { ...userWidget.dashboard_widget.default_config, ...userWidget.custom_config };
  const displayName = userWidget.custom_name || userWidget.dashboard_widget.name;
  const chartType = userWidget.dashboard_widget.chart_type;

  const renderChart = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (!data?.data || data.data.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          No data available
        </div>
      );
    }

    const chartData = data.data;

    switch (chartType) {
      case 'pie':
      case 'doughnut':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={chartType === 'doughnut' ? 40 : 0}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.fill || `hsl(${index * 45}, 70%, 50%)`} />
                ))}
              </Pie>
              {config?.showTooltip && <Tooltip />}
              {config?.showLegend && <Legend />}
            </PieChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              {config?.showTooltip && <Tooltip />}
              {config?.showLegend && <Legend />}
              <Line type="monotone" dataKey="running" stroke="#10B981" strokeWidth={2} />
              <Line type="monotone" dataKey="failed" stroke="#EF4444" strokeWidth={2} />
              <Line type="monotone" dataKey="pending" stroke="#F59E0B" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'bar':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              {config?.showTooltip && <Tooltip />}
              {config?.showLegend && <Legend />}
              <Bar dataKey="value" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              {config?.showTooltip && <Tooltip />}
              {config?.showLegend && <Legend />}
              <Area type="monotone" dataKey="running" stackId="1" stroke="#10B981" fill="#10B981" />
              <Area type="monotone" dataKey="failed" stackId="1" stroke="#EF4444" fill="#EF4444" />
              <Area type="monotone" dataKey="pending" stackId="1" stroke="#F59E0B" fill="#F59E0B" />
            </AreaChart>
          </ResponsiveContainer>
        );

      default:
        return (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Unsupported chart type: {chartType}
          </div>
        );
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium truncate">
          {displayName}
        </CardTitle>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Widget
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Remove Widget
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="h-[calc(100%-4rem)]">
        {renderChart()}
      </CardContent>
    </Card>
  );
}


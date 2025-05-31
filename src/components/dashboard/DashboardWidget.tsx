import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  MoreVertical, 
  RefreshCw, 
  Settings, 
  X, 
  Database,
  CheckCircle2,
  AlertCircle,
  CloudCog,
  FileText,
  Activity,
  Clock
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserWidget, DashboardWidget as DashboardWidgetType } from '@/services/dashboard-service';
import { useAuth } from '@/context/auth-context';
import { dashboardService } from '@/services/dashboard-service';
import { toast } from 'sonner';

interface DashboardWidgetProps {
  userWidget: UserWidget;
  onUpdate: (userWidget: UserWidget) => void;
  onRemove: (userWidgetId: string) => void;
  onEdit: (userWidget: UserWidget) => void;
}

const iconMap = {
  Database,
  CheckCircle2,
  AlertCircle,
  CloudCog,
  FileText,
  Activity,
  Clock
};

export default function DashboardWidget({ userWidget, onUpdate, onRemove, onEdit }: DashboardWidgetProps) {
  const { currentTenant } = useAuth();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const widget = userWidget.dashboard_widget;
  const title = userWidget.custom_title || widget.name;
  const config = { ...widget.default_config, ...userWidget.custom_config };

  // Get icon component
  const IconComponent = iconMap[config?.icon as keyof typeof iconMap] || Database;

  const fetchData = async () => {
    if (!currentTenant) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await dashboardService.refreshWidgetData(widget, currentTenant.tenant_id);
      setData(result);
    } catch (error) {
      console.error(`Error fetching data for widget ${widget.name}:`, error);
      setError('Failed to load widget data');
      toast.error(`Failed to refresh ${title}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Set up auto-refresh if enabled
    if (widget.refresh_interval > 0) {
      const interval = setInterval(fetchData, widget.refresh_interval * 1000);
      return () => clearInterval(interval);
    }
  }, [currentTenant, widget.refresh_interval]);

  const handleRefresh = () => {
    fetchData();
    toast.success(`Refreshing ${title}...`);
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-24">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-24 text-center">
          <AlertCircle className="h-6 w-6 text-destructive mb-2" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      );
    }

    // Render different widget types
    switch (widget.widget_type) {
      case 'card':
        return renderCardWidget();
      case 'chart':
        return renderChartWidget();
      case 'list':
        return renderListWidget();
      default:
        return renderCardWidget();
    }
  };

  const renderCardWidget = () => {
    if (!data) return null;

    let value = 0;
    let subtitle = '';

    // Map data based on widget category
    switch (widget.category) {
      case 'deployments':
        if (widget.name.includes('Total')) {
          value = data.total || 0;
          subtitle = `Across ${Object.keys(data.by_provider || {}).length} providers`;
        } else if (widget.name.includes('Running')) {
          value = data.running || 0;
          subtitle = `${Math.round((value / (data.total || 1)) * 100)}% of total`;
        } else if (widget.name.includes('Failed')) {
          value = data.failed || 0;
          subtitle = `${data.pending || 0} pending resolution`;
        }
        break;
      case 'cloud_accounts':
        value = data.total || 0;
        subtitle = `${data.connected || 0} connected, ${(data.warning || 0) + (data.error || 0)} with issues`;
        break;
      case 'templates':
        value = data.total || 0;
        subtitle = `${Object.keys(data.by_category || {}).length} categories`;
        break;
    }

    return (
      <div className="space-y-2">
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    );
  };

  const renderChartWidget = () => {
    // Placeholder for chart widgets - would integrate with a charting library
    return (
      <div className="flex items-center justify-center h-24 text-muted-foreground">
        <div className="text-center">
          <Activity className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">Chart visualization</p>
        </div>
      </div>
    );
  };

  const renderListWidget = () => {
    if (!data || !data.recent) return null;

    const items = data.recent.slice(0, config?.limit || 5);

    return (
      <div className="space-y-2">
        {items.map((item: any, index: number) => (
          <div key={index} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                item.status === 'running' ? 'bg-green-500' :
                item.status === 'failed' ? 'bg-red-500' : 'bg-gray-500'
              }`} />
              <span className="truncate">{item.name}</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {item.provider?.toUpperCase()}
            </Badge>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <IconComponent className={`h-4 w-4 text-${config?.color || 'muted'}-foreground`} />
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleRefresh}
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
              <DropdownMenuItem onClick={() => onEdit(userWidget)}>
                <Settings className="h-4 w-4 mr-2" />
                Edit Widget
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => onRemove(userWidget.user_widget_id)}
                className="text-destructive"
              >
                <X className="h-4 w-4 mr-2" />
                Remove Widget
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        {widget.description && (
          <CardDescription className="mb-4">{widget.description}</CardDescription>
        )}
        {renderContent()}
      </CardContent>
    </Card>
  );
}


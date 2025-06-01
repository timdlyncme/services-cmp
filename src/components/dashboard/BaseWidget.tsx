import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  MoreVertical, 
  RefreshCw, 
  Settings, 
  Trash2, 
  Eye, 
  EyeOff,
  Maximize2,
  Minimize2
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserWidget, WidgetData } from '@/services/dashboard-service';
import { dashboardService } from '@/services/dashboard-service';
import { useAuth } from '@/context/auth-context';
import { toast } from 'sonner';

interface BaseWidgetProps {
  userWidget: UserWidget;
  onUpdate?: (userWidget: UserWidget) => void;
  onRemove?: (userWidgetId: string) => void;
  onConfigureWidget?: (userWidget: UserWidget) => void;
  isEditing?: boolean;
  className?: string;
}

export default function BaseWidget({
  userWidget,
  onUpdate,
  onRemove,
  onConfigureWidget,
  isEditing = false,
  className = ''
}: BaseWidgetProps) {
  const { currentTenant } = useAuth();
  const [widgetData, setWidgetData] = useState<WidgetData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchWidgetData = async () => {
    if (!userWidget.widget_template.data_source) {
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const config = {
        ...userWidget.widget_template.default_config,
        ...userWidget.custom_config
      };

      const data = await dashboardService.getWidgetData(
        userWidget.widget_template.widget_type,
        userWidget.widget_template.data_source,
        config,
        currentTenant?.tenant_id
      );

      setWidgetData(data);
    } catch (err) {
      console.error('Error fetching widget data:', err);
      setError('Failed to load widget data');
      toast.error('Failed to load widget data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchWidgetData();
  }, [userWidget.widget_id, userWidget.custom_config, currentTenant?.tenant_id]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchWidgetData();
  };

  const handleToggleVisibility = async () => {
    try {
      const updatedWidget = await dashboardService.updateUserWidget(
        userWidget.user_widget_id,
        { is_visible: !userWidget.is_visible }
      );
      onUpdate?.(updatedWidget);
      toast.success(userWidget.is_visible ? 'Widget hidden' : 'Widget shown');
    } catch (err) {
      console.error('Error toggling widget visibility:', err);
      toast.error('Failed to update widget visibility');
    }
  };

  const handleRemove = () => {
    if (window.confirm('Are you sure you want to remove this widget?')) {
      onRemove?.(userWidget.user_widget_id);
    }
  };

  const getWidgetTitle = () => {
    return userWidget.custom_name || userWidget.widget_template.name;
  };

  const getWidgetDescription = () => {
    return userWidget.widget_template.description;
  };

  const renderWidgetContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-32 text-center">
          <p className="text-sm text-destructive mb-2">{error}</p>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            Try Again
          </Button>
        </div>
      );
    }

    // Render different widget types
    switch (userWidget.widget_template.widget_type) {
      case 'platform_stats':
        return renderStatsWidget();
      case 'visual':
        return renderVisualWidget();
      case 'text':
        return renderTextWidget();
      case 'status':
        return renderStatusWidget();
      default:
        return <div className="p-4 text-center text-muted-foreground">Unknown widget type</div>;
    }
  };

  const renderStatsWidget = () => {
    if (!widgetData?.data) return null;

    const config = {
      ...userWidget.widget_template.default_config,
      ...userWidget.custom_config
    };

    const value = getStatValue(widgetData.data, config);
    const subtitle = getStatSubtitle(widgetData.data, config);

    return (
      <div className="text-center">
        <div className="text-3xl font-bold mb-1">{value}</div>
        {subtitle && (
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        )}
      </div>
    );
  };

  const renderVisualWidget = () => {
    if (!widgetData?.data) return null;

    // This would integrate with a charting library like Recharts
    return (
      <div className="h-48 flex items-center justify-center border-2 border-dashed border-muted-foreground/20 rounded">
        <p className="text-muted-foreground">Chart visualization would go here</p>
      </div>
    );
  };

  const renderTextWidget = () => {
    const config = {
      ...userWidget.widget_template.default_config,
      ...userWidget.custom_config
    };

    if (config.text_type === 'welcome') {
      return (
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">{config.title}</h3>
          <p className="text-muted-foreground">{config.content}</p>
        </div>
      );
    }

    if (config.text_type === 'actions') {
      return (
        <div className="space-y-2">
          {config.actions?.map((action: any, index: number) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => window.location.href = action.url}
            >
              {action.label}
            </Button>
          ))}
        </div>
      );
    }

    return (
      <div className="text-center">
        <p className="text-muted-foreground">{config.content || 'No content configured'}</p>
      </div>
    );
  };

  const renderStatusWidget = () => {
    if (!widgetData?.data) return null;

    const config = {
      ...userWidget.widget_template.default_config,
      ...userWidget.custom_config
    };

    if (config.list_type === 'deployments' && widgetData.data.deployments) {
      return (
        <div className="space-y-2">
          {widgetData.data.deployments.slice(0, config.limit || 5).map((deployment: any) => (
            <div key={deployment.id} className="flex items-center justify-between p-2 border rounded">
              <div>
                <p className="text-sm font-medium">{deployment.name}</p>
                <p className="text-xs text-muted-foreground">{deployment.environment}</p>
              </div>
              <div className={`px-2 py-1 rounded text-xs ${
                deployment.status === 'running' ? 'bg-green-100 text-green-800' :
                deployment.status === 'failed' ? 'bg-red-100 text-red-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {deployment.status}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (config.list_type === 'cloud_accounts' && widgetData.data.accounts) {
      return (
        <div className="space-y-2">
          {widgetData.data.accounts.map((account: any) => (
            <div key={account.id} className="flex items-center justify-between p-2 border rounded">
              <div>
                <p className="text-sm font-medium">{account.name}</p>
                <p className="text-xs text-muted-foreground">{account.provider.toUpperCase()}</p>
              </div>
              <div className={`px-2 py-1 rounded text-xs ${
                account.status === 'connected' ? 'bg-green-100 text-green-800' :
                account.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {account.status}
              </div>
            </div>
          ))}
        </div>
      );
    }

    return <div className="text-center text-muted-foreground">No data available</div>;
  };

  const getStatValue = (data: any, config: any) => {
    if (config.filter) {
      const filterType = config.filter.split(':')[1];
      return data[filterType] || 0;
    }
    return data.total || 0;
  };

  const getStatSubtitle = (data: any, config: any) => {
    if (config.filter) {
      return `of ${data.total || 0} total`;
    }
    
    if (data.status_breakdown) {
      const statuses = Object.keys(data.status_breakdown);
      return `${statuses.length} status types`;
    }
    
    if (data.provider_breakdown) {
      const providers = Object.keys(data.provider_breakdown);
      return `across ${providers.length} providers`;
    }
    
    return null;
  };

  return (
    <Card className={`relative ${className} ${!userWidget.is_visible ? 'opacity-50' : ''} ${userWidget.color || ''}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex-1 min-w-0">
          <CardTitle className="text-sm font-medium truncate">
            {getWidgetTitle()}
          </CardTitle>
          {getWidgetDescription() && (
            <CardDescription className="text-xs truncate">
              {getWidgetDescription()}
            </CardDescription>
          )}
        </div>
        
        {isEditing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleRefresh} disabled={isRefreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onConfigureWidget?.(userWidget)}>
                <Settings className="h-4 w-4 mr-2" />
                Configure
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleToggleVisibility}>
                {userWidget.is_visible ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Hide
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Show
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleRemove} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        
        {!isEditing && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </CardHeader>
      
      <CardContent>
        {renderWidgetContent()}
      </CardContent>
    </Card>
  );
}

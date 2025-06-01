import React from 'react';
import { BaseWidget } from './BaseWidget';
import { UserWidget, WidgetData } from '@/types/dashboard';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface TableWidgetProps {
  userWidget: UserWidget;
  data: WidgetData;
  isLoading?: boolean;
  onRefresh?: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
}

export function TableWidget({
  userWidget,
  data,
  isLoading = false,
  onRefresh,
  onEdit,
  onRemove,
}: TableWidgetProps) {
  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
      case 'connected':
        return 'default';
      case 'failed':
      case 'error':
        return 'destructive';
      case 'pending':
      case 'warning':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getProviderBadgeColor = (provider: string) => {
    switch (provider.toLowerCase()) {
      case 'azure':
        return 'bg-blue-100 text-blue-800';
      case 'aws':
        return 'bg-yellow-100 text-yellow-800';
      case 'gcp':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const renderTableContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-muted-foreground">Loading data...</div>
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

    // Determine table type based on data source
    const isDeploymentTable = userWidget.widget.data_source.includes('deployments');
    const isCloudAccountTable = userWidget.widget.data_source.includes('cloud-accounts');

    return (
      <div className="overflow-auto h-full">
        <div className="space-y-2">
          {data.data.map((item: any, index: number) => (
            <div
              key={item.id || index}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">
                    {item.name}
                  </p>
                  <Badge variant={getStatusBadgeVariant(item.status)}>
                    {item.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {isDeploymentTable && (
                    <>
                      <span className={`px-2 py-1 rounded-full text-xs ${getProviderBadgeColor(item.provider)}`}>
                        {item.provider?.toUpperCase()}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {item.environment} • {item.template}
                      </span>
                    </>
                  )}
                  {isCloudAccountTable && (
                    <span className={`px-2 py-1 rounded-full text-xs ${getProviderBadgeColor(item.provider)}`}>
                      {item.provider?.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <BaseWidget
      userWidget={userWidget}
      isLoading={isLoading}
      onRefresh={onRefresh}
      onEdit={onEdit}
      onRemove={onRemove}
    >
      {renderTableContent()}
    </BaseWidget>
  );
}


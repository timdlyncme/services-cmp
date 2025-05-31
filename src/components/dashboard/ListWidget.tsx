import React from 'react';
import { BaseWidget } from './BaseWidget';
import { DashboardWidget } from '@/services/dashboard-service';
import { Activity, AlertCircle, CheckCircle2, Clock, CloudCog, Database } from 'lucide-react';

interface ListWidgetProps {
  widget: DashboardWidget;
  data: any;
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function ListWidget({
  widget,
  data,
  isLoading,
  error,
  onRefresh,
  onEdit,
  onDelete
}: ListWidgetProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
      case 'connected':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'failed':
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
      case 'warning':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getProviderBadgeColor = (provider: string) => {
    switch (provider?.toLowerCase()) {
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

  const renderListContent = () => {
    if (!data || !data.items || !Array.isArray(data.items)) {
      return (
        <div className="text-center py-4">
          <div className="text-sm text-muted-foreground">No items to display</div>
        </div>
      );
    }

    if (data.items.length === 0) {
      return (
        <div className="text-center py-4">
          <Database className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <div className="text-sm text-muted-foreground">No items found</div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {data.items.map((item: any, index: number) => (
          <div
            key={item.id || index}
            className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0"
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {item.status && (
                <div className="flex-shrink-0">
                  {getStatusIcon(item.status)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {item.provider && (
                    <span className={`px-2 py-1 rounded-full ${getProviderBadgeColor(item.provider)}`}>
                      {item.provider.toUpperCase()}
                    </span>
                  )}
                  {item.type && (
                    <span>{item.type}</span>
                  )}
                  {item.created_at && (
                    <span>{new Date(item.created_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </div>
            {item.status && (
              <div className={`px-2 py-1 rounded-full text-xs ${
                item.status === 'running' || item.status === 'connected' ? 'bg-green-100 text-green-800' :
                item.status === 'failed' || item.status === 'error' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {item.status.toUpperCase()}
              </div>
            )}
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
      {renderListContent()}
    </BaseWidget>
  );
}


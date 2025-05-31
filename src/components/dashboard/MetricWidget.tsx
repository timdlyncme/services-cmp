import React from 'react';
import { BaseWidget } from './BaseWidget';
import { DashboardWidget } from '@/services/dashboard-service';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface MetricWidgetProps {
  widget: DashboardWidget;
  data: any;
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function MetricWidget({
  widget,
  data,
  isLoading,
  error,
  onRefresh,
  onEdit,
  onDelete
}: MetricWidgetProps) {
  const renderMetricContent = () => {
    if (!data) return null;

    // Handle different metric types based on data source
    if (widget.data_source === 'deployments') {
      return (
        <div className="space-y-2">
          <div className="text-2xl font-bold">{data.total || 0}</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center">
              <div className="text-green-600 font-medium">{data.running || 0}</div>
              <div className="text-muted-foreground">Running</div>
            </div>
            <div className="text-center">
              <div className="text-red-600 font-medium">{data.failed || 0}</div>
              <div className="text-muted-foreground">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-yellow-600 font-medium">{data.pending || 0}</div>
              <div className="text-muted-foreground">Pending</div>
            </div>
          </div>
        </div>
      );
    }

    if (widget.data_source === 'cloud_accounts') {
      return (
        <div className="space-y-2">
          <div className="text-2xl font-bold">{data.total || 0}</div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center">
              <div className="text-green-600 font-medium">{data.connected || 0}</div>
              <div className="text-muted-foreground">Connected</div>
            </div>
            <div className="text-center">
              <div className="text-yellow-600 font-medium">{data.warning || 0}</div>
              <div className="text-muted-foreground">Warning</div>
            </div>
            <div className="text-center">
              <div className="text-red-600 font-medium">{data.error || 0}</div>
              <div className="text-muted-foreground">Error</div>
            </div>
          </div>
        </div>
      );
    }

    // Generic metric display
    if (typeof data === 'object' && data.total !== undefined) {
      return (
        <div className="space-y-2">
          <div className="text-2xl font-bold">{data.total}</div>
          {data.subtitle && (
            <p className="text-xs text-muted-foreground">{data.subtitle}</p>
          )}
        </div>
      );
    }

    // Simple number display
    if (typeof data === 'number') {
      return <div className="text-2xl font-bold">{data}</div>;
    }

    // Fallback
    return (
      <div className="text-center py-4">
        <div className="text-sm text-muted-foreground">No data available</div>
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
      {renderMetricContent()}
    </BaseWidget>
  );
}


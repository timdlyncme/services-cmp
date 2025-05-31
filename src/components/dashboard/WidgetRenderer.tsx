import React, { useState, useEffect } from 'react';
import { DashboardWidget, dashboardService, WidgetData } from '@/services/dashboard-service';
import { useAuth } from '@/context/auth-context';
import { MetricWidget } from './MetricWidget';
import { ListWidget } from './ListWidget';
import { ChartWidget } from './ChartWidget';
import { BaseWidget } from './BaseWidget';
import { toast } from 'sonner';

interface WidgetRendererProps {
  widget: DashboardWidget;
  onEdit?: (widget: DashboardWidget) => void;
  onDelete?: (widget: DashboardWidget) => void;
}

export function WidgetRenderer({ widget, onEdit, onDelete }: WidgetRendererProps) {
  const { currentTenant } = useAuth();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWidgetData = async () => {
    if (!currentTenant) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await dashboardService.getWidgetData({
        widget_type: widget.widget_type,
        data_source: widget.data_source,
        configuration: widget.configuration,
        tenant_id: currentTenant.tenant_id
      });

      setData(response.data);
    } catch (err) {
      console.error('Error fetching widget data:', err);
      setError('Failed to load widget data');
      toast.error('Failed to load widget data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWidgetData();

    // Set up auto-refresh if refresh_interval is set
    if (widget.refresh_interval > 0) {
      const interval = setInterval(fetchWidgetData, widget.refresh_interval * 1000);
      return () => clearInterval(interval);
    }
  }, [widget, currentTenant]);

  const handleRefresh = () => {
    fetchWidgetData();
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(widget);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(widget);
    }
  };

  // Render the appropriate widget component based on type
  const renderWidget = () => {
    const commonProps = {
      widget,
      data,
      isLoading,
      error,
      onRefresh: handleRefresh,
      onEdit: handleEdit,
      onDelete: handleDelete
    };

    switch (widget.widget_type) {
      case 'metric':
        return <MetricWidget {...commonProps} />;
      case 'list':
        return <ListWidget {...commonProps} />;
      case 'chart':
        return <ChartWidget {...commonProps} />;
      case 'table':
        // TODO: Implement TableWidget
        return <ListWidget {...commonProps} />;
      case 'status':
        // TODO: Implement StatusWidget
        return <MetricWidget {...commonProps} />;
      default:
        return (
          <BaseWidget {...commonProps}>
            <div className="text-center py-4">
              <div className="text-sm text-muted-foreground">
                Unknown widget type: {widget.widget_type}
              </div>
            </div>
          </BaseWidget>
        );
    }
  };

  return renderWidget();
}


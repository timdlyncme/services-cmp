import React from 'react';
import { BaseWidget } from './BaseWidget';
import { UserWidget, WidgetData } from '@/types/dashboard';
import * as Icons from 'lucide-react';

interface CardWidgetProps {
  userWidget: UserWidget;
  data: WidgetData;
  isLoading?: boolean;
  onRefresh?: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
}

export function CardWidget({
  userWidget,
  data,
  isLoading = false,
  onRefresh,
  onEdit,
  onRemove,
}: CardWidgetProps) {
  const iconName = userWidget.widget.icon || 'Square';
  const IconComponent = (Icons as any)[iconName] || Icons.Square;

  const getStatusColor = () => {
    if (userWidget.widget.data_source.includes('failed')) {
      return 'text-red-600';
    }
    if (userWidget.widget.data_source.includes('running')) {
      return 'text-green-600';
    }
    return 'text-muted-foreground';
  };

  return (
    <BaseWidget
      userWidget={userWidget}
      isLoading={isLoading}
      onRefresh={onRefresh}
      onEdit={onEdit}
      onRemove={onRemove}
    >
      <div className="flex items-center justify-between h-full">
        <div className="flex-1">
          <div className="text-2xl font-bold">
            {isLoading ? '...' : data.value || 0}
          </div>
          {data.percentage !== undefined && (
            <p className="text-xs text-muted-foreground">
              {data.percentage}% of total
            </p>
          )}
          {data.connected !== undefined && (
            <p className="text-xs text-muted-foreground">
              {data.connected} connected
            </p>
          )}
          {data.label && (
            <p className="text-xs text-muted-foreground mt-1">
              {data.label}
            </p>
          )}
        </div>
        <div className="flex-shrink-0">
          <IconComponent className={`h-8 w-8 ${getStatusColor()}`} />
        </div>
      </div>
    </BaseWidget>
  );
}


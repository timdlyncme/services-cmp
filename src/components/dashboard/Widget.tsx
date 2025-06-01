import { useState, useEffect } from "react";
import { UserWidget, WidgetData } from "./widget-types";
import { StatCardWidget } from "./StatCardWidget";
import { ChartWidget } from "./ChartWidget";
import { TableWidget } from "./TableWidget";
import { useAuth } from "@/context/auth-context";
import { toast } from "sonner";

interface WidgetProps {
  userWidget: UserWidget;
  onEdit: (userWidget: UserWidget) => void;
  onDelete: (userWidget: UserWidget) => void;
}

export function Widget({ userWidget, onEdit, onDelete }: WidgetProps) {
  const [data, setData] = useState<WidgetData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { currentTenant } = useAuth();

  const fetchWidgetData = async () => {
    if (!currentTenant) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/widget-data/${userWidget.dashboard_widget.data_source}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch widget data');
      }

      const widgetData = await response.json();
      setData(widgetData);
    } catch (error) {
      console.error('Error fetching widget data:', error);
      toast.error('Failed to load widget data');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWidgetData();
  }, [userWidget.dashboard_widget.data_source, currentTenant]);

  const handleRefresh = () => {
    fetchWidgetData();
  };

  const handleEdit = () => {
    onEdit(userWidget);
  };

  const handleDelete = () => {
    onDelete(userWidget);
  };

  const commonProps = {
    userWidget,
    data,
    isLoading,
    onRefresh: handleRefresh,
    onEdit: handleEdit,
    onDelete: handleDelete,
  };

  switch (userWidget.dashboard_widget.widget_type) {
    case 'stat_card':
      return <StatCardWidget {...commonProps} />;
    case 'chart':
      return <ChartWidget {...commonProps} />;
    case 'table':
      return <TableWidget {...commonProps} />;
    default:
      return (
        <div className="p-4 border border-dashed border-gray-300 rounded-lg">
          <p className="text-muted-foreground">
            Unknown widget type: {userWidget.dashboard_widget.widget_type}
          </p>
        </div>
      );
  }
}


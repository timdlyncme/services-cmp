import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  RefreshCw,
  MoreVertical,
  Edit,
  Trash2,
  Activity,
  AlertCircle,
  Clock
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserWidget, WidgetData } from "./widget-types";

interface TableWidgetProps {
  userWidget: UserWidget;
  data: WidgetData | null;
  isLoading: boolean;
  onRefresh: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function TableWidget({ 
  userWidget, 
  data, 
  isLoading, 
  onRefresh, 
  onEdit, 
  onDelete 
}: TableWidgetProps) {
  const config = { ...userWidget.dashboard_widget.default_config, ...userWidget.custom_config };
  const displayName = userWidget.custom_name || userWidget.dashboard_widget.name;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Activity className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      running: "default",
      failed: "destructive",
      pending: "secondary",
      completed: "outline"
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || "outline"}>
        {status}
      </Badge>
    );
  };

  const getProviderBadge = (provider: string) => {
    const colors = {
      aws: "bg-yellow-100 text-yellow-800",
      azure: "bg-blue-100 text-blue-800",
      gcp: "bg-green-100 text-green-800"
    } as const;

    return (
      <Badge 
        variant="outline" 
        className={colors[provider as keyof typeof colors] || "bg-gray-100 text-gray-800"}
      >
        {provider?.toUpperCase()}
      </Badge>
    );
  };

  const renderTableContent = () => {
    if (isLoading) {
      return (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between border-b pb-2">
              <div className="space-y-1">
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                <div className="h-3 w-24 bg-muted animate-pulse rounded" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-6 w-16 bg-muted animate-pulse rounded" />
                <div className="h-3 w-20 bg-muted animate-pulse rounded" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (!data?.data || data.data.length === 0) {
      return (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          No data available
        </div>
      );
    }

    const tableData = data.data.slice(0, config?.limit || 10);

    return (
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {tableData.map((item: any, index: number) => (
          <div
            key={item.id || index}
            className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {config?.showStatus && item.status && (
                <div className="flex-shrink-0">
                  {getStatusIcon(item.status)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {item.template_name && `${item.template_name} • `}
                  {item.environment}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {item.status && getStatusBadge(item.status)}
              {item.provider && getProviderBadge(item.provider)}
              {item.created_at && (
                <p className="text-xs text-muted-foreground">
                  {new Date(item.created_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    );
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
        {renderTableContent()}
      </CardContent>
    </Card>
  );
}


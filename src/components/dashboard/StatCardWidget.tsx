import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Activity, 
  Database, 
  CloudCog, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw,
  MoreVertical,
  Edit,
  Trash2
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserWidget, WidgetData } from "./widget-types";

interface StatCardWidgetProps {
  userWidget: UserWidget;
  data: WidgetData | null;
  isLoading: boolean;
  onRefresh: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const iconMap = {
  activity: Activity,
  database: Database,
  cloud: CloudCog,
  "alert-circle": AlertCircle,
  "check-circle": CheckCircle2,
};

const colorMap = {
  blue: "text-blue-600",
  green: "text-green-600",
  red: "text-red-600",
  purple: "text-purple-600",
  yellow: "text-yellow-600",
  gray: "text-gray-600",
};

export function StatCardWidget({ 
  userWidget, 
  data, 
  isLoading, 
  onRefresh, 
  onEdit, 
  onDelete 
}: StatCardWidgetProps) {
  const config = { ...userWidget.dashboard_widget.default_config, ...userWidget.custom_config };
  const IconComponent = iconMap[config?.icon as keyof typeof iconMap] || Database;
  const iconColor = colorMap[config?.color as keyof typeof colorMap] || "text-muted-foreground";
  const displayName = userWidget.custom_name || userWidget.dashboard_widget.name;

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
      <CardContent>
        <div className="flex items-center gap-2 mb-2">
          <IconComponent className={`h-4 w-4 ${iconColor}`} />
          <div className="text-2xl font-bold">
            {isLoading ? (
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            ) : (
              data?.value ?? 0
            )}
          </div>
        </div>
        {data?.subtitle && (
          <p className="text-xs text-muted-foreground">
            {data.subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
}


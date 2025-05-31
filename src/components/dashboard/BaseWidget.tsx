import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, RefreshCw, Settings, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DashboardWidget } from '@/services/dashboard-service';

interface BaseWidgetProps {
  widget: DashboardWidget;
  children: React.ReactNode;
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function BaseWidget({
  widget,
  children,
  isLoading = false,
  error = null,
  onRefresh,
  onEdit,
  onDelete,
  className = ''
}: BaseWidgetProps) {
  return (
    <Card className={`relative ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex-1">
          <CardTitle className="text-sm font-medium">{widget.title}</CardTitle>
          {widget.data_source && (
            <CardDescription className="text-xs">
              {widget.data_source.replace('_', ' ').toUpperCase()}
            </CardDescription>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-6 w-6 p-0"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                <MoreHorizontal className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onClick={onEdit}>
                  <Settings className="mr-2 h-4 w-4" />
                  Edit Widget
                </DropdownMenuItem>
              )}
              {onRefresh && (
                <DropdownMenuItem onClick={onRefresh}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem onClick={onDelete} className="text-destructive">
                  <X className="mr-2 h-4 w-4" />
                  Remove Widget
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        {error ? (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <div className="text-sm text-destructive mb-2">Error loading widget</div>
            <div className="text-xs text-muted-foreground">{error}</div>
            {onRefresh && (
              <Button variant="outline" size="sm" onClick={onRefresh} className="mt-2">
                Try Again
              </Button>
            )}
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}


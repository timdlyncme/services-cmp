import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical, RefreshCw, Settings, Trash2 } from 'lucide-react';
import { UserWidget } from '@/types/dashboard';

interface BaseWidgetProps {
  userWidget: UserWidget;
  children: React.ReactNode;
  isLoading?: boolean;
  onRefresh?: () => void;
  onEdit?: () => void;
  onRemove?: () => void;
  className?: string;
}

export function BaseWidget({
  userWidget,
  children,
  isLoading = false,
  onRefresh,
  onEdit,
  onRemove,
  className = '',
}: BaseWidgetProps) {
  const displayName = userWidget.custom_name || userWidget.widget.name;

  return (
    <Card className={`h-full ${className}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium truncate">
          {displayName}
        </CardTitle>
        <div className="flex items-center gap-1">
          {onRefresh && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onClick={onEdit}>
                  <Settings className="mr-2 h-4 w-4" />
                  Edit Widget
                </DropdownMenuItem>
              )}
              {onRemove && (
                <DropdownMenuItem onClick={onRemove} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove Widget
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="h-[calc(100%-4rem)]">
        {children}
      </CardContent>
    </Card>
  );
}


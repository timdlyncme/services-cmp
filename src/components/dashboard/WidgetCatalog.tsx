import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DashboardWidget } from '@/types/dashboard';
import { dashboardService } from '@/services/dashboard-service';
import * as Icons from 'lucide-react';
import { toast } from 'sonner';

interface WidgetCatalogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddWidget: (widget: DashboardWidget) => void;
}

export function WidgetCatalog({ open, onOpenChange, onAddWidget }: WidgetCatalogProps) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    if (open) {
      loadWidgets();
    }
  }, [open]);

  const loadWidgets = async () => {
    setLoading(true);
    try {
      const data = await dashboardService.getWidgetCatalog();
      setWidgets(data);
    } catch (error) {
      console.error('Error loading widget catalog:', error);
      toast.error('Failed to load widget catalog');
    } finally {
      setLoading(false);
    }
  };

  const categories = [
    { value: 'all', label: 'All Widgets' },
    { value: 'deployments', label: 'Deployments' },
    { value: 'cloud', label: 'Cloud' },
    { value: 'analytics', label: 'Analytics' },
    { value: 'templates', label: 'Templates' },
  ];

  const filteredWidgets = selectedCategory === 'all' 
    ? widgets 
    : widgets.filter(widget => widget.category === selectedCategory);

  const getWidgetTypeIcon = (type: string) => {
    switch (type) {
      case 'card':
        return Icons.Square;
      case 'chart':
        return Icons.BarChart3;
      case 'table':
        return Icons.Table;
      default:
        return Icons.Square;
    }
  };

  const getChartTypeLabel = (chartType?: string) => {
    if (!chartType) return '';
    return chartType.charAt(0).toUpperCase() + chartType.slice(1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Widget Catalog</DialogTitle>
          <DialogDescription>
            Choose from a variety of widgets to customize your dashboard
          </DialogDescription>
        </DialogHeader>

        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="flex-1">
          <TabsList className="grid w-full grid-cols-5">
            {categories.map((category) => (
              <TabsTrigger key={category.value} value={category.value}>
                {category.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-4 overflow-auto max-h-[60vh]">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <div className="text-muted-foreground">Loading widgets...</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredWidgets.map((widget) => {
                  const IconComponent = (Icons as any)[widget.icon || 'Square'] || Icons.Square;
                  const TypeIcon = getWidgetTypeIcon(widget.widget_type);

                  return (
                    <Card key={widget.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <IconComponent className="h-5 w-5 text-muted-foreground" />
                            <CardTitle className="text-sm">{widget.name}</CardTitle>
                          </div>
                          <div className="flex items-center gap-1">
                            <TypeIcon className="h-4 w-4 text-muted-foreground" />
                            {widget.chart_type && (
                              <Badge variant="outline" className="text-xs">
                                {getChartTypeLabel(widget.chart_type)}
                              </Badge>
                            )}
                          </div>
                        </div>
                        {widget.description && (
                          <CardDescription className="text-xs">
                            {widget.description}
                          </CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {widget.category && (
                              <Badge variant="secondary" className="text-xs">
                                {widget.category}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {widget.widget_type}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => {
                              onAddWidget(widget);
                              onOpenChange(false);
                            }}
                          >
                            Add
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {!loading && filteredWidgets.length === 0 && (
              <div className="flex items-center justify-center h-32">
                <div className="text-muted-foreground">
                  No widgets found in this category
                </div>
              </div>
            )}
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}


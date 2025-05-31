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
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Database, CheckCircle2, AlertCircle, CloudCog, FileText, Activity } from 'lucide-react';
import { DashboardWidget, dashboardService } from '@/services/dashboard-service';
import { toast } from 'sonner';

interface WidgetSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWidgetSelect: (widget: DashboardWidget) => void;
}

const iconMap = {
  Database,
  CheckCircle2,
  AlertCircle,
  CloudCog,
  FileText,
  Activity
};

const categoryLabels = {
  deployments: 'Deployments',
  cloud_accounts: 'Cloud Accounts',
  templates: 'Templates',
  resources: 'Resources'
};

export default function WidgetSelector({ open, onOpenChange, onWidgetSelect }: WidgetSelectorProps) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    if (open) {
      fetchWidgets();
    }
  }, [open]);

  const fetchWidgets = async () => {
    setIsLoading(true);
    try {
      const availableWidgets = await dashboardService.getAvailableWidgets();
      setWidgets(availableWidgets);
    } catch (error) {
      console.error('Error fetching widgets:', error);
      toast.error('Failed to load available widgets');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredWidgets = selectedCategory === 'all' 
    ? widgets 
    : widgets.filter(widget => widget.category === selectedCategory);

  const categories = Array.from(new Set(widgets.map(widget => widget.category)));

  const handleWidgetSelect = (widget: DashboardWidget) => {
    onWidgetSelect(widget);
    onOpenChange(false);
  };

  const renderWidget = (widget: DashboardWidget) => {
    const IconComponent = iconMap[widget.default_config?.icon as keyof typeof iconMap] || Database;
    
    return (
      <Card 
        key={widget.id} 
        className="cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => handleWidgetSelect(widget)}
      >
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IconComponent className={`h-5 w-5 text-${widget.default_config?.color || 'muted'}-foreground`} />
              <CardTitle className="text-base">{widget.name}</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs">
              {widget.widget_type}
            </Badge>
          </div>
          {widget.description && (
            <CardDescription className="text-sm">
              {widget.description}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Category: {categoryLabels[widget.category as keyof typeof categoryLabels] || widget.category}</span>
            <span>Refresh: {widget.refresh_interval}s</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add Widget to Dashboard</DialogTitle>
          <DialogDescription>
            Choose from available widgets to add to your dashboard. You can customize them after adding.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="flex-1 overflow-hidden">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="all">All</TabsTrigger>
            {categories.map(category => (
              <TabsTrigger key={category} value={category}>
                {categoryLabels[category as keyof typeof categoryLabels] || category}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-4 overflow-y-auto max-h-[50vh]">
            <TabsContent value={selectedCategory} className="mt-0">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center">
                    <Activity className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading widgets...</p>
                  </div>
                </div>
              ) : filteredWidgets.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredWidgets.map(renderWidget)}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <Plus className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No widgets available in this category
                  </p>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Database, 
  BarChart3, 
  Table, 
  Plus,
  Activity,
  CloudCog,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { DashboardWidget } from "./widget-types";
import { toast } from "sonner";

interface WidgetCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddWidget: (widget: DashboardWidget) => void;
}

const widgetTypeIcons = {
  stat_card: Database,
  chart: BarChart3,
  table: Table,
};

const categoryIcons = {
  deployments: Activity,
  cloud_accounts: CloudCog,
  analytics: BarChart3,
  templates: Database,
  environments: CheckCircle2,
};

export function WidgetCatalogDialog({ 
  open, 
  onOpenChange, 
  onAddWidget 
}: WidgetCatalogDialogProps) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const fetchWidgets = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/dashboards/widgets/catalog', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch widget catalog');
      }

      const data = await response.json();
      setWidgets(data);
    } catch (error) {
      console.error('Error fetching widget catalog:', error);
      toast.error('Failed to load widget catalog');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchWidgets();
    }
  }, [open]);

  const categories = Array.from(new Set(widgets.map(w => w.category)));
  const filteredWidgets = selectedCategory === "all" 
    ? widgets 
    : widgets.filter(w => w.category === selectedCategory);

  const handleAddWidget = (widget: DashboardWidget) => {
    onAddWidget(widget);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Widget Catalog</DialogTitle>
          <DialogDescription>
            Choose from a variety of widgets to customize your dashboard
          </DialogDescription>
        </DialogHeader>

        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="all">All</TabsTrigger>
            {categories.map((category) => (
              <TabsTrigger key={category} value={category} className="capitalize">
                {category.replace('_', ' ')}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={selectedCategory} className="mt-4">
            <ScrollArea className="h-[500px]">
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardHeader>
                        <div className="h-4 bg-muted rounded w-3/4" />
                        <div className="h-3 bg-muted rounded w-1/2" />
                      </CardHeader>
                      <CardContent>
                        <div className="h-3 bg-muted rounded w-full mb-2" />
                        <div className="h-3 bg-muted rounded w-2/3" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredWidgets.map((widget) => {
                    const WidgetIcon = widgetTypeIcons[widget.widget_type] || Database;
                    const CategoryIcon = categoryIcons[widget.category as keyof typeof categoryIcons] || Database;

                    return (
                      <Card key={widget.widget_id} className="hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <WidgetIcon className="h-5 w-5 text-primary" />
                              <CardTitle className="text-sm">{widget.name}</CardTitle>
                            </div>
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className="text-xs">
                                <CategoryIcon className="h-3 w-3 mr-1" />
                                {widget.category.replace('_', ' ')}
                              </Badge>
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
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant="secondary" className="text-xs">
                                {widget.widget_type.replace('_', ' ')}
                              </Badge>
                              {widget.chart_type && (
                                <Badge variant="outline" className="text-xs">
                                  {widget.chart_type}
                                </Badge>
                              )}
                            </div>
                            <Button
                              size="sm"
                              onClick={() => handleAddWidget(widget)}
                              className="h-7"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add
                            </Button>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            Size: {widget.default_width}×{widget.default_height} 
                            (min: {widget.min_width}×{widget.min_height})
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {!isLoading && filteredWidgets.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                  <Database className="h-8 w-8 mb-2" />
                  <p>No widgets found in this category</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}


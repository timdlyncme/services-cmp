import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Database, 
  BarChart3, 
  FileText, 
  Activity, 
  Plus,
  Search
} from 'lucide-react';
import { DashboardWidget, dashboardService } from '@/services/dashboard-service';
import { toast } from 'sonner';

interface WidgetCatalogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddWidget: (widgetId: string, customName?: string) => void;
}

const categoryIcons = {
  statistics: Database,
  charts: BarChart3,
  information: FileText,
  monitoring: Activity,
};

const widgetTypeColors = {
  platform_stats: 'bg-blue-100 text-blue-800',
  visual: 'bg-green-100 text-green-800',
  text: 'bg-purple-100 text-purple-800',
  status: 'bg-orange-100 text-orange-800',
};

export default function WidgetCatalog({ isOpen, onClose, onAddWidget }: WidgetCatalogProps) {
  const [widgets, setWidgets] = useState<DashboardWidget[]>([]);
  const [filteredWidgets, setFilteredWidgets] = useState<DashboardWidget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedWidget, setSelectedWidget] = useState<DashboardWidget | null>(null);
  const [customName, setCustomName] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchWidgets();
    }
  }, [isOpen]);

  useEffect(() => {
    filterWidgets();
  }, [widgets, searchTerm, selectedCategory]);

  const fetchWidgets = async () => {
    try {
      setIsLoading(true);
      const widgetTemplates = await dashboardService.getWidgetTemplates();
      setWidgets(widgetTemplates);
    } catch (error) {
      console.error('Error fetching widget templates:', error);
      toast.error('Failed to load widget catalog');
    } finally {
      setIsLoading(false);
    }
  };

  const filterWidgets = () => {
    let filtered = widgets;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(widget => widget.category === selectedCategory);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(widget =>
        widget.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        widget.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredWidgets(filtered);
  };

  const handleAddWidget = () => {
    if (selectedWidget) {
      onAddWidget(selectedWidget.widget_id, customName || undefined);
      setSelectedWidget(null);
      setCustomName('');
      onClose();
      toast.success(`Added ${selectedWidget.name} to dashboard`);
    }
  };

  const getCategories = () => {
    const categories = Array.from(new Set(widgets.map(w => w.category)));
    return ['all', ...categories];
  };

  const getCategoryDisplayName = (category: string) => {
    if (category === 'all') return 'All Widgets';
    return category.charAt(0).toUpperCase() + category.slice(1);
  };

  const getCategoryIcon = (category: string) => {
    const IconComponent = categoryIcons[category as keyof typeof categoryIcons];
    return IconComponent ? <IconComponent className="h-4 w-4" /> : <Database className="h-4 w-4" />;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Widget Catalog</DialogTitle>
          <DialogDescription>
            Choose from available widgets to add to your dashboard
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          {/* Search and Filter */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search widgets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Category Tabs */}
          <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="grid w-full grid-cols-5">
              {getCategories().map((category) => (
                <TabsTrigger key={category} value={category} className="flex items-center gap-2">
                  {category !== 'all' && getCategoryIcon(category)}
                  <span className="hidden sm:inline">{getCategoryDisplayName(category)}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="flex-1 overflow-auto mt-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredWidgets.map((widget) => (
                    <Card
                      key={widget.widget_id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        selectedWidget?.widget_id === widget.widget_id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => setSelectedWidget(widget)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <CardTitle className="text-sm font-medium truncate">
                              {widget.name}
                            </CardTitle>
                            <CardDescription className="text-xs mt-1 line-clamp-2">
                              {widget.description}
                            </CardDescription>
                          </div>
                          <Badge
                            variant="secondary"
                            className={`ml-2 text-xs ${widgetTypeColors[widget.widget_type]}`}
                          >
                            {widget.widget_type.replace('_', ' ')}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Size: {widget.min_width}×{widget.min_height}</span>
                          <span className="flex items-center gap-1">
                            {getCategoryIcon(widget.category)}
                            {widget.category}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {!isLoading && filteredWidgets.length === 0 && (
                <div className="flex flex-col items-center justify-center h-32 text-center">
                  <Database className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No widgets found</p>
                  <p className="text-sm text-muted-foreground">Try adjusting your search or category filter</p>
                </div>
              )}
            </div>
          </Tabs>

          {/* Selected Widget Details */}
          {selectedWidget && (
            <div className="border-t pt-4">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <h4 className="font-medium">{selectedWidget.name}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedWidget.description}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span>Type: {selectedWidget.widget_type.replace('_', ' ')}</span>
                    <span>Category: {selectedWidget.category}</span>
                    <span>
                      Size: {selectedWidget.min_width}×{selectedWidget.min_height}
                      {selectedWidget.max_width && selectedWidget.max_height && 
                        ` to ${selectedWidget.max_width}×${selectedWidget.max_height}`
                      }
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 min-w-0 w-48">
                  <Label htmlFor="custom-name" className="text-xs">
                    Custom Name (Optional)
                  </Label>
                  <Input
                    id="custom-name"
                    placeholder={selectedWidget.name}
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAddWidget} disabled={!selectedWidget}>
            <Plus className="h-4 w-4 mr-2" />
            Add Widget
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

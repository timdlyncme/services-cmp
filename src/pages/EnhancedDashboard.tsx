import React, { useState, useEffect, useCallback } from 'react';
import { Responsive, WidthProvider, Layout } from 'react-grid-layout';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, 
  RefreshCw, 
  ChevronDown, 
  Settings, 
  Trash2,
  Edit3
} from 'lucide-react';
import { toast } from 'sonner';

import { Dashboard, UserWidget, DashboardWidget, WidgetData, GridLayout } from '@/types/dashboard';
import { dashboardService } from '@/services/dashboard-service';
import { CardWidget } from '@/components/dashboard/CardWidget';
import { ChartWidget } from '@/components/dashboard/ChartWidget';
import { TableWidget } from '@/components/dashboard/TableWidget';
import { WidgetCatalog } from '@/components/dashboard/WidgetCatalog';

// Import CSS for react-grid-layout
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

export default function EnhancedDashboard() {
  const { user, currentTenant } = useAuth();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [currentDashboard, setCurrentDashboard] = useState<Dashboard | null>(null);
  const [widgetData, setWidgetData] = useState<Record<string, WidgetData>>({});
  const [loadingWidgets, setLoadingWidgets] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [showWidgetCatalog, setShowWidgetCatalog] = useState(false);
  const [showCreateDashboard, setShowCreateDashboard] = useState(false);
  const [showEditDashboard, setShowEditDashboard] = useState(false);
  const [newDashboardName, setNewDashboardName] = useState('');
  const [newDashboardDescription, setNewDashboardDescription] = useState('');

  // Load dashboards on component mount
  useEffect(() => {
    loadDashboards();
  }, []);

  // Load widget data when dashboard changes or tenant changes
  useEffect(() => {
    if (currentDashboard && currentTenant) {
      loadAllWidgetData();
    }
  }, [currentDashboard, currentTenant]);

  const loadDashboards = async () => {
    setIsLoading(true);
    try {
      const data = await dashboardService.getDashboards();
      setDashboards(data);
      
      // Set default dashboard or first dashboard
      const defaultDashboard = data.find(d => d.is_default) || data[0];
      if (defaultDashboard) {
        setCurrentDashboard(defaultDashboard);
      } else if (data.length === 0) {
        // Create a default dashboard if none exist
        await createDefaultDashboard();
      }
    } catch (error) {
      console.error('Error loading dashboards:', error);
      toast.error('Failed to load dashboards');
    } finally {
      setIsLoading(false);
    }
  };

  const createDefaultDashboard = async () => {
    try {
      const dashboard = await dashboardService.createDashboard({
        name: 'My Dashboard',
        description: 'Default dashboard',
        is_default: true,
      });
      setDashboards([dashboard]);
      setCurrentDashboard(dashboard);
    } catch (error) {
      console.error('Error creating default dashboard:', error);
      toast.error('Failed to create default dashboard');
    }
  };

  const loadAllWidgetData = async () => {
    if (!currentDashboard) return;

    const widgets = currentDashboard.user_widgets;
    const loadingSet = new Set(widgets.map(w => w.user_widget_id));
    setLoadingWidgets(loadingSet);

    const dataPromises = widgets.map(async (widget) => {
      try {
        const data = await dashboardService.getWidgetData(
          widget.widget.data_source,
          widget.filters
        );
        return { widgetId: widget.user_widget_id, data };
      } catch (error) {
        console.error(`Error loading data for widget ${widget.user_widget_id}:`, error);
        return { 
          widgetId: widget.user_widget_id, 
          data: { error: 'Failed to load data' } 
        };
      }
    });

    const results = await Promise.all(dataPromises);
    const newWidgetData: Record<string, WidgetData> = {};
    
    results.forEach(({ widgetId, data }) => {
      newWidgetData[widgetId] = data;
    });

    setWidgetData(newWidgetData);
    setLoadingWidgets(new Set());
  };

  const refreshWidget = async (userWidgetId: string, dataSource: string, filters?: any) => {
    setLoadingWidgets(prev => new Set([...prev, userWidgetId]));
    
    try {
      const data = await dashboardService.getWidgetData(dataSource, filters);
      setWidgetData(prev => ({
        ...prev,
        [userWidgetId]: data,
      }));
      toast.success('Widget refreshed');
    } catch (error) {
      console.error('Error refreshing widget:', error);
      toast.error('Failed to refresh widget');
    } finally {
      setLoadingWidgets(prev => {
        const newSet = new Set(prev);
        newSet.delete(userWidgetId);
        return newSet;
      });
    }
  };

  const handleLayoutChange = useCallback(async (layout: Layout[]) => {
    if (!currentDashboard) return;

    try {
      const gridLayout: GridLayout[] = layout.map(item => ({
        i: item.i,
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
      }));

      await dashboardService.updateDashboardLayout(currentDashboard.dashboard_id, gridLayout);
      
      // Update local state
      setCurrentDashboard(prev => prev ? {
        ...prev,
        layout: gridLayout,
      } : null);
    } catch (error) {
      console.error('Error updating layout:', error);
      toast.error('Failed to save layout');
    }
  }, [currentDashboard]);

  const handleAddWidget = async (widget: DashboardWidget) => {
    if (!currentDashboard) return;

    try {
      const userWidget = await dashboardService.addWidgetToDashboard(
        currentDashboard.dashboard_id,
        {
          widget_id: widget.id,
          dashboard_id: currentDashboard.id,
          position: {
            i: `widget-${Date.now()}`,
            x: 0,
            y: 0,
            w: widget.default_size?.w || 4,
            h: widget.default_size?.h || 3,
          },
        }
      );

      // Refresh dashboard to get updated widgets
      const updatedDashboard = await dashboardService.getDashboard(currentDashboard.dashboard_id);
      setCurrentDashboard(updatedDashboard);
      
      // Load data for the new widget
      refreshWidget(userWidget.user_widget_id, widget.data_source);
      
      toast.success('Widget added to dashboard');
    } catch (error) {
      console.error('Error adding widget:', error);
      toast.error('Failed to add widget');
    }
  };

  const handleRemoveWidget = async (userWidgetId: string) => {
    try {
      await dashboardService.removeUserWidget(userWidgetId);
      
      // Update local state
      setCurrentDashboard(prev => prev ? {
        ...prev,
        user_widgets: prev.user_widgets.filter(w => w.user_widget_id !== userWidgetId),
      } : null);
      
      // Remove widget data
      setWidgetData(prev => {
        const newData = { ...prev };
        delete newData[userWidgetId];
        return newData;
      });
      
      toast.success('Widget removed');
    } catch (error) {
      console.error('Error removing widget:', error);
      toast.error('Failed to remove widget');
    }
  };

  const handleCreateDashboard = async () => {
    if (!newDashboardName.trim()) return;

    try {
      const dashboard = await dashboardService.createDashboard({
        name: newDashboardName,
        description: newDashboardDescription,
        is_default: dashboards.length === 0,
      });

      setDashboards(prev => [...prev, dashboard]);
      setCurrentDashboard(dashboard);
      setShowCreateDashboard(false);
      setNewDashboardName('');
      setNewDashboardDescription('');
      
      toast.success('Dashboard created');
    } catch (error) {
      console.error('Error creating dashboard:', error);
      toast.error('Failed to create dashboard');
    }
  };

  const handleDeleteDashboard = async (dashboardId: string) => {
    if (dashboards.length <= 1) {
      toast.error('Cannot delete the last dashboard');
      return;
    }

    try {
      await dashboardService.deleteDashboard(dashboardId);
      
      const updatedDashboards = dashboards.filter(d => d.dashboard_id !== dashboardId);
      setDashboards(updatedDashboards);
      
      if (currentDashboard?.dashboard_id === dashboardId) {
        setCurrentDashboard(updatedDashboards[0] || null);
      }
      
      toast.success('Dashboard deleted');
    } catch (error) {
      console.error('Error deleting dashboard:', error);
      toast.error('Failed to delete dashboard');
    }
  };

  const renderWidget = (userWidget: UserWidget) => {
    const data = widgetData[userWidget.user_widget_id] || {};
    const isWidgetLoading = loadingWidgets.has(userWidget.user_widget_id);

    const commonProps = {
      userWidget,
      data,
      isLoading: isWidgetLoading,
      onRefresh: () => refreshWidget(
        userWidget.user_widget_id, 
        userWidget.widget.data_source, 
        userWidget.filters
      ),
      onRemove: () => handleRemoveWidget(userWidget.user_widget_id),
    };

    switch (userWidget.widget.widget_type) {
      case 'card':
        return <CardWidget {...commonProps} />;
      case 'chart':
        return <ChartWidget {...commonProps} />;
      case 'table':
        return <TableWidget {...commonProps} />;
      default:
        return <CardWidget {...commonProps} />;
    }
  };

  const getGridLayout = (): Layout[] => {
    if (!currentDashboard) return [];

    return currentDashboard.user_widgets.map((widget, index) => {
      const position = widget.position || currentDashboard.layout?.find(l => l.i === widget.user_widget_id);
      const defaultSize = widget.widget.default_size || { w: 4, h: 3 };

      return {
        i: widget.user_widget_id,
        x: position?.x || (index * defaultSize.w) % 12,
        y: position?.y || Math.floor((index * defaultSize.w) / 12) * defaultSize.h,
        w: position?.w || defaultSize.w,
        h: position?.h || defaultSize.h,
        minW: 2,
        minH: 2,
      };
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {user?.name}
            </p>
          </div>
          
          {/* Dashboard Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center gap-2">
                {currentDashboard?.name || 'Select Dashboard'}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {dashboards.map((dashboard) => (
                <DropdownMenuItem
                  key={dashboard.id}
                  onClick={() => setCurrentDashboard(dashboard)}
                  className="flex items-center justify-between"
                >
                  <span>{dashboard.name}</span>
                  {dashboard.is_default && (
                    <span className="text-xs text-muted-foreground">Default</span>
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={() => setShowCreateDashboard(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create New Dashboard
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={loadAllWidgetData}
            disabled={!currentDashboard}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          
          <Button
            onClick={() => setShowWidgetCatalog(true)}
            disabled={!currentDashboard}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Widget
          </Button>

          {currentDashboard && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setShowEditDashboard(true)}>
                  <Edit3 className="mr-2 h-4 w-4" />
                  Edit Dashboard
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => handleDeleteDashboard(currentDashboard.dashboard_id)}
                  className="text-destructive"
                  disabled={dashboards.length <= 1}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Dashboard
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Dashboard Content */}
      {currentDashboard ? (
        currentDashboard.user_widgets.length > 0 ? (
          <ResponsiveGridLayout
            className="layout"
            layouts={{ lg: getGridLayout() }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
            rowHeight={60}
            onLayoutChange={handleLayoutChange}
            isDraggable={true}
            isResizable={true}
            margin={[16, 16]}
            containerPadding={[0, 0]}
          >
            {currentDashboard.user_widgets.map((widget) => (
              <div key={widget.user_widget_id}>
                {renderWidget(widget)}
              </div>
            ))}
          </ResponsiveGridLayout>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <Plus className="h-10 w-10 text-muted-foreground mb-2" />
              <h3 className="text-lg font-medium">No widgets yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Add widgets to customize your dashboard
              </p>
              <Button onClick={() => setShowWidgetCatalog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Widget
              </Button>
            </CardContent>
          </Card>
        )
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <h3 className="text-lg font-medium">No dashboard selected</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create a dashboard to get started
            </p>
            <Button onClick={() => setShowCreateDashboard(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Dashboard
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Widget Catalog Dialog */}
      <WidgetCatalog
        open={showWidgetCatalog}
        onOpenChange={setShowWidgetCatalog}
        onAddWidget={handleAddWidget}
      />

      {/* Create Dashboard Dialog */}
      <Dialog open={showCreateDashboard} onOpenChange={setShowCreateDashboard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Dashboard</DialogTitle>
            <DialogDescription>
              Create a new dashboard to organize your widgets
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Dashboard Name</Label>
              <Input
                id="name"
                value={newDashboardName}
                onChange={(e) => setNewDashboardName(e.target.value)}
                placeholder="Enter dashboard name"
              />
            </div>
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={newDashboardDescription}
                onChange={(e) => setNewDashboardDescription(e.target.value)}
                placeholder="Enter dashboard description"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDashboard(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateDashboard} disabled={!newDashboardName.trim()}>
              Create Dashboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


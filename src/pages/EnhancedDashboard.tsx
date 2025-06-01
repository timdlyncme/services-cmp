import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, 
  Settings, 
  RefreshCw, 
  Edit3, 
  Save,
  X,
  LayoutDashboard
} from 'lucide-react';
import { toast } from 'sonner';
import { Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import '../styles/dashboard.css';

import BaseWidget from '@/components/dashboard/BaseWidget';
import WidgetCatalog from '@/components/dashboard/WidgetCatalog';
import DashboardManager from '@/components/dashboard/DashboardManager';
import { WidgetConfigModal } from '@/components/dashboard/WidgetConfigModal';
import { 
  Dashboard, 
  DashboardWithWidgets, 
  UserWidget,
  dashboardService
} from '../services/dashboard-service';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface GridLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export default function EnhancedDashboard() {
  const { user, currentTenant } = useAuth();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [currentDashboard, setCurrentDashboard] = useState<DashboardWithWidgets | null>(null);
  const [currentDashboardId, setCurrentDashboardId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showWidgetCatalog, setShowWidgetCatalog] = useState(false);
  const [showDashboardManager, setShowDashboardManager] = useState(false);
  const [configWidget, setConfigWidget] = useState<UserWidget | null>(null);
  const [layouts, setLayouts] = useState<{ [key: string]: GridLayoutItem[] }>({});

  // Grid layout configuration
  const breakpoints = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
  const cols = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };
  const rowHeight = 60; // Increased from 60 to 120 for better content fit

  useEffect(() => {
    loadDashboards();
  }, []);

  useEffect(() => {
    if (currentDashboardId) {
      loadDashboard(currentDashboardId);
    }
  }, [currentDashboardId]);

  // Convert UserWidget to GridLayoutItem
  const convertToGridLayout = useCallback((userWidgets: UserWidget[]): GridLayoutItem[] => {
    return userWidgets
      .filter(widget => widget.is_visible)
      .map(widget => ({
        i: widget.user_widget_id,
        x: widget.position_x,
        y: widget.position_y,
        w: Math.max(widget.width, widget.widget_template.min_width, 1), // Ensure minimum width of 3
        h: Math.max(widget.height, widget.widget_template.min_height, 2), // Ensure minimum height of 3
        minW: Math.max(widget.widget_template.min_width, 1), // Minimum 2 columns
        minH: Math.max(widget.widget_template.min_height, 2), // Minimum 2 rows
        // Remove maxW and maxH constraints to allow unlimited resizing
      }));
  }, []);

  // Update layouts when dashboard changes
  useEffect(() => {
    if (currentDashboard) {
      const gridLayout = convertToGridLayout(currentDashboard.user_widgets);
      setLayouts({
        lg: gridLayout,
        md: gridLayout,
        sm: gridLayout,
        xs: gridLayout,
        xxs: gridLayout,
      });
    }
  }, [currentDashboard, convertToGridLayout]);

  const loadDashboards = async () => {
    try {
      setIsLoading(true);
      const userDashboards = await dashboardService.getDashboards();
      setDashboards(userDashboards);
      
      // Load the default dashboard or the first one
      if (userDashboards.length > 0) {
        const defaultDashboard = userDashboards.find(d => d.is_default) || userDashboards[0];
        setCurrentDashboardId(defaultDashboard.dashboard_id);
      }
    } catch (error) {
      console.error('Error loading dashboards:', error);
      toast.error('Failed to load dashboards');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDashboard = async (dashboardId: string) => {
    try {
      setIsLoading(true);
      const dashboard = await dashboardService.getDashboard(dashboardId);
      setCurrentDashboard(dashboard);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast.error('Failed to load dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDashboardSelect = async (dashboard: Dashboard) => {
    try {
      setCurrentDashboardId(dashboard.dashboard_id);
      setShowDashboardManager(false);
      toast.success(`Switched to ${dashboard.name}`);
    } catch (error) {
      console.error('Error selecting dashboard:', error);
      toast.error('Failed to switch dashboard');
    }
  };

  const handleDashboardChange = (dashboardId: string) => {
    if (dashboardId === 'create-new') {
      setShowDashboardManager(true);
      return;
    }
    setCurrentDashboardId(dashboardId);
  };

  const handleAddWidget = async (widgetId: string, customName?: string) => {
    if (!currentDashboard) return;
    
    try {
      // Find a good position for the new widget
      const existingLayout = layouts.lg || [];
      const newPosition = findNextAvailablePosition(existingLayout);
      
      const newWidget = await dashboardService.addWidgetToDashboard(currentDashboard.dashboard_id, {
        dashboard_id: currentDashboard.dashboard_id,
        widget_id: widgetId,
        custom_name: customName,
        position_x: newPosition.x,
        position_y: newPosition.y,
        width: newPosition.w,
        height: newPosition.h,
        is_visible: true
      });
      
      setCurrentDashboard(prev => prev ? {
        ...prev,
        user_widgets: [...prev.user_widgets, newWidget]
      } : null);
      
      toast.success('Widget added successfully!');
    } catch (error) {
      console.error('Error adding widget:', error);
      toast.error('Failed to add widget');
    }
  };

  // Find next available position for new widgets
  const findNextAvailablePosition = (existingLayout: GridLayoutItem[]) => {
    const defaultSize = { w: 4, h: 4 }; // Increased default size from 4x4 to better fit content
    
    // If no widgets exist, place at top-left
    if (existingLayout.length === 0) {
      return { x: 0, y: 0, ...defaultSize };
    }

    // Find the bottom-most widget and place below it
    const maxY = Math.max(...existingLayout.map(item => item.y + item.h));
    return { x: 0, y: maxY, ...defaultSize };
  };

  const handleLayoutChange = (layout: GridLayoutItem[], allLayouts: { [key: string]: GridLayoutItem[] }) => {
    if (!isEditing || !currentDashboard) return;

    // Update layouts state
    setLayouts(allLayouts);

    // Update the dashboard state with new positions
    const updatedWidgets = currentDashboard.user_widgets.map(widget => {
      const layoutItem = layout.find(item => item.i === widget.user_widget_id);
      if (layoutItem) {
        return {
          ...widget,
          position_x: layoutItem.x,
          position_y: layoutItem.y,
          width: layoutItem.w,
          height: layoutItem.h,
        };
      }
      return widget;
    });

    setCurrentDashboard(prev => prev ? {
      ...prev,
      user_widgets: updatedWidgets
    } : null);
  };

  const handleUpdateWidget = async (userWidgetId: string, updates: Partial<UserWidget>) => {
    try {
      await dashboardService.updateUserWidget(userWidgetId, updates);
      
      // Update the local state
      setCurrentDashboard(prev => prev ? {
        ...prev,
        user_widgets: prev.user_widgets.map(widget =>
          widget.user_widget_id === userWidgetId
            ? { ...widget, ...updates }
            : widget
        )
      } : null);
    } catch (error) {
      console.error('Error updating widget:', error);
      toast.error('Failed to update widget');
    }
  };

  const handleRemoveWidget = async (userWidgetId: string) => {
    try {
      await dashboardService.removeWidgetFromDashboard(userWidgetId);
      
      // Update the local state
      setCurrentDashboard(prev => prev ? {
        ...prev,
        user_widgets: prev.user_widgets.filter(widget => widget.user_widget_id !== userWidgetId)
      } : null);

      toast.success('Widget removed successfully!');
    } catch (error) {
      console.error('Error removing widget:', error);
      toast.error('Failed to remove widget');
    }
  };

  const handleConfigureWidget = (userWidget: UserWidget) => {
    setConfigWidget(userWidget);
  };

  const handleSaveWidgetConfig = async (updates: Partial<UserWidget>) => {
    if (!configWidget) return;

    try {
      await dashboardService.updateUserWidget(configWidget.user_widget_id, updates);
      
      // Update the local state
      setCurrentDashboard(prev => prev ? {
        ...prev,
        user_widgets: prev.user_widgets.map(widget =>
          widget.user_widget_id === configWidget.user_widget_id
            ? { ...widget, ...updates }
            : widget
        )
      } : null);

      toast.success('Widget configuration saved!');
    } catch (error) {
      console.error('Error saving widget configuration:', error);
      toast.error('Failed to save widget configuration');
    }
  };

  const handleRefreshDashboard = () => {
    if (currentDashboard) {
      loadDashboard(currentDashboard.dashboard_id);
      toast.success('Dashboard refreshed');
    }
  };

  const handleSaveLayout = async () => {
    if (!currentDashboard) return;

    try {
      const layoutUpdate = {
        layout_config: layouts,
        widgets: currentDashboard.user_widgets.map(widget => ({
          user_widget_id: widget.user_widget_id,
          position_x: widget.position_x,
          position_y: widget.position_y,
          width: widget.width,
          height: widget.height,
          is_visible: widget.is_visible
        }))
      };

      await dashboardService.updateDashboardLayout(currentDashboard.dashboard_id, layoutUpdate);
      setIsEditing(false);
      toast.success('Dashboard layout saved');
    } catch (error) {
      console.error('Error saving layout:', error);
      toast.error('Failed to save layout');
    }
  };

  const handleCreateDashboard = async () => {
    const name = prompt('Enter dashboard name:');
    if (!name?.trim()) return;

    try {
      const newDashboard = await dashboardService.createDashboard({
        name: name.trim(),
        description: `Custom dashboard: ${name.trim()}`
      });

      // Refresh the dashboards list to include the new dashboard
      await loadDashboards();
      
      // Set the new dashboard as current
      setCurrentDashboardId(newDashboard.dashboard_id);
      
      toast.success('Dashboard created successfully!');
    } catch (error) {
      console.error('Error creating dashboard:', error);
      toast.error('Failed to create dashboard');
    }
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
          {dashboards.length > 0 && (
            <Select 
              value={currentDashboard?.dashboard_id || ''} 
              onValueChange={handleDashboardChange}
            >
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Select a dashboard" />
              </SelectTrigger>
              <SelectContent>
                {dashboards.map((dashboard) => (
                  <SelectItem key={dashboard.dashboard_id} value={dashboard.dashboard_id}>
                    {dashboard.name}
                  </SelectItem>
                ))}
                <SelectItem value="create-new" className="text-blue-600 font-medium">
                  <Plus className="w-4 h-4 mr-2 inline" />
                  Create New Dashboard
                </SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefreshDashboard}
            disabled={!currentDashboard}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            onClick={() => setShowDashboardManager(true)}
          >
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Manage
          </Button>

          {currentDashboard && (
            <>
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button onClick={handleSaveLayout}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Layout
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}

              {isEditing && (
                <Button onClick={() => setShowWidgetCatalog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Widget
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Dashboard Content */}
      {!currentDashboard ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <LayoutDashboard className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Dashboard Selected</h3>
          <p className="text-muted-foreground mb-4">
            Create your first dashboard to get started
          </p>
          <Button onClick={() => setShowDashboardManager(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Dashboard
          </Button>
        </div>
      ) : currentDashboard.user_widgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <Plus className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Widgets Yet</h3>
          <p className="text-muted-foreground mb-4">
            Add widgets to customize your dashboard
          </p>
          <Button onClick={() => setShowWidgetCatalog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Widget
          </Button>
        </div>
      ) : (
        <div className="dashboard-container">
          <ResponsiveGridLayout
            className="layout"
            layouts={layouts}
            breakpoints={breakpoints}
            cols={cols}
            rowHeight={rowHeight}
            onLayoutChange={handleLayoutChange}
            isDraggable={isEditing}
            isResizable={isEditing}
            compactType="vertical"
            preventCollision={false}
            margin={[16, 16]}
            containerPadding={[0, 0]}
            maxRows={Infinity} // Allow unlimited rows
            autoSize={true} // Auto-size the container
          >
            {currentDashboard.user_widgets
              .filter(widget => widget.is_visible)
              .map((userWidget) => (
                <div key={userWidget.user_widget_id}>
                  <BaseWidget
                    userWidget={userWidget}
                    onUpdate={handleUpdateWidget}
                    onRemove={handleRemoveWidget}
                    onConfigureWidget={handleConfigureWidget}
                    isEditing={isEditing}
                    className={isEditing ? 'border-dashed border-2 border-primary/20' : ''}
                  />
                </div>
              ))}
          </ResponsiveGridLayout>
        </div>
      )}

      {/* Dialogs */}
      <WidgetCatalog
        isOpen={showWidgetCatalog}
        onClose={() => setShowWidgetCatalog(false)}
        onAddWidget={handleAddWidget}
      />

      {configWidget && (
        <WidgetConfigModal
          isOpen={true}
          onClose={() => setConfigWidget(null)}
          userWidget={configWidget}
          onSave={handleSaveWidgetConfig}
        />
      )}

      <DashboardManager
        isOpen={showDashboardManager}
        onClose={() => setShowDashboardManager(false)}
        onDashboardSelect={handleDashboardSelect}
        currentDashboard={currentDashboard || undefined}
      />
    </div>
  );
}

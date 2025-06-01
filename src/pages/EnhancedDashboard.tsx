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
import GridLayoutDashboard from '@/components/dashboard/GridLayoutDashboard';
import WidgetCatalog from '@/components/dashboard/WidgetCatalog';
import DashboardManager from '@/components/dashboard/DashboardManager';
import { WidgetConfigModal } from '@/components/dashboard/WidgetConfigModal';
import { dashboardService } from '@/services/dashboardService';
import { widgetService } from '@/services/widgetService';
import { Dashboard, UserWidget, Widget } from '@/types/dashboard';

export default function EnhancedDashboard() {
  const { user } = useAuth();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [currentDashboard, setCurrentDashboard] = useState<Dashboard | null>(null);
  const [widgets, setWidgets] = useState<UserWidget[]>([]);
  const [availableWidgets, setAvailableWidgets] = useState<Widget[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showWidgetCatalog, setShowWidgetCatalog] = useState(false);
  const [showDashboardManager, setShowDashboardManager] = useState(false);
  const [configWidget, setConfigWidget] = useState<UserWidget | null>(null);

  // Load dashboards
  const loadDashboards = useCallback(async () => {
    if (!user?.organization_id) return;
    
    try {
      const dashboardsData = await dashboardService.getDashboards(user.organization_id);
      setDashboards(dashboardsData);
      
      if (dashboardsData.length > 0 && !currentDashboard) {
        setCurrentDashboard(dashboardsData[0]);
      }
    } catch (error) {
      console.error('Error loading dashboards:', error);
      toast.error('Failed to load dashboards');
    }
  }, [user?.organization_id, currentDashboard]);

  // Load widgets for current dashboard
  const loadWidgets = useCallback(async () => {
    if (!currentDashboard) return;
    
    try {
      setIsLoading(true);
      const widgetsData = await dashboardService.getDashboardWidgets(currentDashboard.dashboard_id);
      setWidgets(widgetsData);
    } catch (error) {
      console.error('Error loading widgets:', error);
      toast.error('Failed to load widgets');
    } finally {
      setIsLoading(false);
    }
  }, [currentDashboard]);

  // Load available widgets
  const loadAvailableWidgets = useCallback(async () => {
    try {
      const availableWidgetsData = await widgetService.getWidgets();
      setAvailableWidgets(availableWidgetsData);
    } catch (error) {
      console.error('Error loading available widgets:', error);
      toast.error('Failed to load available widgets');
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadDashboards();
    loadAvailableWidgets();
  }, [loadDashboards, loadAvailableWidgets]);

  // Load widgets when dashboard changes
  useEffect(() => {
    loadWidgets();
  }, [loadWidgets]);

  // Handle dashboard selection
  const handleDashboardChange = (dashboardId: string) => {
    const dashboard = dashboards.find(d => d.dashboard_id === dashboardId);
    if (dashboard) {
      setCurrentDashboard(dashboard);
      setIsEditing(false);
    }
  };

  // Handle adding widget
  const handleAddWidget = async (widgetId: string, config: any) => {
    if (!currentDashboard) return;

    try {
      // Find next available position
      const maxY = Math.max(...widgets.map(w => w.position_y + w.height), 0);
      
      const newWidget = await dashboardService.addWidgetToDashboard(
        currentDashboard.dashboard_id,
        widgetId,
        {
          position_x: 0,
          position_y: maxY,
          width: 2,
          height: 2,
          ...config
        }
      );

      setWidgets(prev => [...prev, newWidget]);
      setShowWidgetCatalog(false);
      toast.success('Widget added successfully!');
    } catch (error) {
      console.error('Error adding widget:', error);
      toast.error('Failed to add widget');
    }
  };

  // Handle deleting widget
  const handleDeleteWidget = async (widgetId: string) => {
    try {
      await dashboardService.removeWidgetFromDashboard(widgetId);
      setWidgets(prev => prev.filter(w => w.user_widget_id !== widgetId));
      toast.success('Widget removed successfully!');
    } catch (error) {
      console.error('Error removing widget:', error);
      toast.error('Failed to remove widget');
    }
  };

  // Handle updating widgets (from grid layout changes)
  const handleUpdateWidgets = (updatedWidgets: UserWidget[]) => {
    setWidgets(updatedWidgets);
  };

  // Handle widget configuration
  const handleConfigureWidget = (widget: UserWidget) => {
    setConfigWidget(widget);
  };

  // Handle saving widget configuration
  const handleSaveWidgetConfig = async (config: any) => {
    if (!configWidget) return;

    try {
      await dashboardService.updateUserWidget(configWidget.user_widget_id, config);
      
      setWidgets(prev => prev.map(w => 
        w.user_widget_id === configWidget.user_widget_id 
          ? { ...w, ...config }
          : w
      ));
      
      setConfigWidget(null);
      toast.success('Widget configuration saved!');
    } catch (error) {
      console.error('Error saving widget config:', error);
      toast.error('Failed to save widget configuration');
    }
  };

  // Handle creating new dashboard
  const handleCreateDashboard = async (name: string, description?: string) => {
    if (!user?.organization_id) return;

    try {
      const newDashboard = await dashboardService.createDashboard({
        name,
        description: description || '',
        organization_id: user.organization_id,
        is_default: dashboards.length === 0
      });

      setDashboards(prev => [...prev, newDashboard]);
      setCurrentDashboard(newDashboard);
      setShowDashboardManager(false);
      toast.success('Dashboard created successfully!');
    } catch (error) {
      console.error('Error creating dashboard:', error);
      toast.error('Failed to create dashboard');
    }
  };

  if (isLoading && !currentDashboard) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <LayoutDashboard className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            
            {/* Dashboard Selector */}
            {dashboards.length > 0 && (
              <Select
                value={currentDashboard?.dashboard_id || ''}
                onValueChange={handleDashboardChange}
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Select dashboard" />
                </SelectTrigger>
                <SelectContent>
                  {dashboards.map(dashboard => (
                    <SelectItem key={dashboard.dashboard_id} value={dashboard.dashboard_id}>
                      {dashboard.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDashboardManager(true)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Manage
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowWidgetCatalog(true)}
              disabled={!currentDashboard}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Widget
            </Button>
            
            <Button
              variant={isEditing ? "default" : "outline"}
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
              disabled={!currentDashboard}
            >
              {isEditing ? (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Layout
                </>
              ) : (
                <>
                  <Edit3 className="h-4 w-4 mr-2" />
                  Edit Layout
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="p-6">
        {currentDashboard ? (
          <>
            {/* Dashboard Info */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                {currentDashboard.name}
              </h2>
              {currentDashboard.description && (
                <p className="text-gray-600">{currentDashboard.description}</p>
              )}
              {isEditing && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-800">
                    <Edit3 className="h-4 w-4 inline mr-1" />
                    Edit mode: Drag widgets to reposition, resize by dragging corners, or use widget menus to configure.
                  </p>
                </div>
              )}
            </div>

            {/* Grid Layout Dashboard */}
            <GridLayoutDashboard
              widgets={widgets}
              isEditing={isEditing}
              onConfigureWidget={handleConfigureWidget}
              onDeleteWidget={handleDeleteWidget}
              onUpdateWidgets={handleUpdateWidgets}
            />
          </>
        ) : (
          <div className="text-center py-12">
            <LayoutDashboard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Dashboard Selected</h3>
            <p className="text-gray-600 mb-4">Create a new dashboard to get started.</p>
            <Button onClick={() => setShowDashboardManager(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Dashboard
            </Button>
          </div>
        )}
      </div>

      {/* Modals */}
      <WidgetCatalog
        isOpen={showWidgetCatalog}
        onClose={() => setShowWidgetCatalog(false)}
        widgets={availableWidgets}
        onAddWidget={handleAddWidget}
      />

      <DashboardManager
        isOpen={showDashboardManager}
        onClose={() => setShowDashboardManager(false)}
        dashboards={dashboards}
        onCreateDashboard={handleCreateDashboard}
        onRefresh={loadDashboards}
      />

      {configWidget && (
        <WidgetConfigModal
          isOpen={!!configWidget}
          onClose={() => setConfigWidget(null)}
          widget={configWidget}
          onSave={handleSaveWidgetConfig}
        />
      )}
    </div>
  );
}


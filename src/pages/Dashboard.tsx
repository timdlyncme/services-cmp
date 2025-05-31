import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  RefreshCw,
  Plus,
  Settings,
  ChevronDown,
  LayoutDashboard
} from "lucide-react";
import { toast } from "sonner";
import { 
  Dashboard as DashboardType, 
  UserWidget, 
  DashboardWidget as DashboardWidgetType,
  dashboardService,
  CreateUserWidgetRequest
} from "@/services/dashboard-service";
import DashboardWidget from "@/components/dashboard/DashboardWidget";
import WidgetSelector from "@/components/dashboard/WidgetSelector";
import DashboardManager from "@/components/dashboard/DashboardManager";

export default function Dashboard() {
  const { user, currentTenant } = useAuth();
  const [dashboards, setDashboards] = useState<DashboardType[]>([]);
  const [currentDashboard, setCurrentDashboard] = useState<DashboardType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWidgetSelector, setShowWidgetSelector] = useState(false);
  const [showDashboardManager, setShowDashboardManager] = useState(false);

  // Load dashboards and set current dashboard
  const loadDashboards = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const userDashboards = await dashboardService.getUserDashboards();
      setDashboards(userDashboards);
      
      // Set current dashboard (default or first available)
      if (userDashboards.length > 0) {
        const defaultDashboard = userDashboards.find(d => d.is_default) || userDashboards[0];
        setCurrentDashboard(defaultDashboard);
      } else {
        // Create a default dashboard if none exist
        await createDefaultDashboard();
      }
    } catch (error) {
      console.error("Error loading dashboards:", error);
      setError("Failed to load dashboards. Please try again.");
      toast.error("Failed to load dashboards");
    } finally {
      setIsLoading(false);
    }
  };

  // Create a default dashboard with some basic widgets
  const createDefaultDashboard = async () => {
    try {
      const defaultDashboard = await dashboardService.createDashboard({
        name: "My Dashboard",
        description: "Your personalized dashboard",
        is_default: true
      });
      
      setDashboards([defaultDashboard]);
      setCurrentDashboard(defaultDashboard);
      
      // Add some default widgets
      const availableWidgets = await dashboardService.getAvailableWidgets();
      const defaultWidgets = availableWidgets.slice(0, 4); // Add first 4 widgets
      
      for (let i = 0; i < defaultWidgets.length; i++) {
        const widget = defaultWidgets[i];
        await dashboardService.addWidgetToDashboard(defaultDashboard.dashboard_id, {
          dashboard_widget_id: widget.id,
          position_x: (i % 2) * 6,
          position_y: Math.floor(i / 2) * 4,
          width: 6,
          height: 4
        });
      }
      
      // Reload the dashboard to get the widgets
      const updatedDashboard = await dashboardService.getDashboard(defaultDashboard.dashboard_id);
      setCurrentDashboard(updatedDashboard);
      
    } catch (error) {
      console.error("Error creating default dashboard:", error);
      toast.error("Failed to create default dashboard");
    }
  };

  useEffect(() => {
    if (user) {
      loadDashboards();
    }
  }, [user]);

  const handleRefreshDashboard = async () => {
    if (!currentDashboard) return;
    
    try {
      const refreshedDashboard = await dashboardService.getDashboard(currentDashboard.dashboard_id);
      setCurrentDashboard(refreshedDashboard);
      toast.success("Dashboard refreshed successfully");
    } catch (error) {
      console.error("Error refreshing dashboard:", error);
      toast.error("Failed to refresh dashboard");
    }
  };

  const handleDashboardChange = async (dashboardId: string) => {
    const dashboard = dashboards.find(d => d.dashboard_id === dashboardId);
    if (dashboard) {
      try {
        const fullDashboard = await dashboardService.getDashboard(dashboard.dashboard_id);
        setCurrentDashboard(fullDashboard);
      } catch (error) {
        console.error("Error loading dashboard:", error);
        toast.error("Failed to load dashboard");
      }
    }
  };

  const handleAddWidget = async (widget: DashboardWidgetType) => {
    if (!currentDashboard) return;
    
    try {
      // Find a good position for the new widget
      const existingWidgets = currentDashboard.user_widgets;
      let position_x = 0;
      let position_y = 0;
      
      // Simple grid placement logic
      if (existingWidgets.length > 0) {
        const maxY = Math.max(...existingWidgets.map(w => w.position_y + w.height));
        position_y = maxY;
      }
      
      const newUserWidget = await dashboardService.addWidgetToDashboard(
        currentDashboard.dashboard_id,
        {
          dashboard_widget_id: widget.id,
          position_x,
          position_y,
          width: 6,
          height: 4
        }
      );
      
      // Update current dashboard
      setCurrentDashboard({
        ...currentDashboard,
        user_widgets: [...currentDashboard.user_widgets, newUserWidget]
      });
      
      toast.success(`Added ${widget.name} to dashboard`);
    } catch (error) {
      console.error("Error adding widget:", error);
      toast.error("Failed to add widget");
    }
  };

  const handleUpdateWidget = async (updatedWidget: UserWidget) => {
    if (!currentDashboard) return;
    
    setCurrentDashboard({
      ...currentDashboard,
      user_widgets: currentDashboard.user_widgets.map(w => 
        w.id === updatedWidget.id ? updatedWidget : w
      )
    });
  };

  const handleRemoveWidget = async (userWidgetId: string) => {
    if (!currentDashboard) return;
    
    try {
      await dashboardService.removeWidgetFromDashboard(currentDashboard.dashboard_id, userWidgetId);
      
      setCurrentDashboard({
        ...currentDashboard,
        user_widgets: currentDashboard.user_widgets.filter(w => w.user_widget_id !== userWidgetId)
      });
      
      toast.success("Widget removed from dashboard");
    } catch (error) {
      console.error("Error removing widget:", error);
      toast.error("Failed to remove widget");
    }
  };

  const handleEditWidget = (userWidget: UserWidget) => {
    // TODO: Implement widget editing dialog
    toast.info("Widget editing coming soon!");
  };

  const handleDashboardSelect = (dashboard: DashboardType) => {
    setCurrentDashboard(dashboard);
    // Update dashboards list if it was modified
    loadDashboards();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <h3 className="text-lg font-medium mb-2">Error loading dashboard</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button variant="outline" onClick={loadDashboards}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {user?.name}
            </p>
          </div>
          
          {/* Dashboard Selector */}
          {dashboards.length > 1 && (
            <Select 
              value={currentDashboard?.dashboard_id || ""} 
              onValueChange={handleDashboardChange}
            >
              <SelectTrigger className="w-[200px]">
                <LayoutDashboard className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Select dashboard" />
              </SelectTrigger>
              <SelectContent>
                {dashboards.map((dashboard) => (
                  <SelectItem key={dashboard.dashboard_id} value={dashboard.dashboard_id}>
                    <div className="flex items-center gap-2">
                      <span>{dashboard.name}</span>
                      {dashboard.is_default && (
                        <span className="text-xs text-muted-foreground">(Default)</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleRefreshDashboard}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setShowWidgetSelector(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Widget
          </Button>
          <Button variant="outline" onClick={() => setShowDashboardManager(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Manage
          </Button>
        </div>
      </div>

      {/* Dashboard Content */}
      {currentDashboard ? (
        currentDashboard.user_widgets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {currentDashboard.user_widgets
              .filter(widget => widget.is_visible)
              .map((userWidget) => (
                <div
                  key={userWidget.id}
                  className={`col-span-1`}
                  style={{
                    gridColumn: `span ${Math.min(userWidget.width / 3, 4)}`,
                  }}
                >
                  <DashboardWidget
                    userWidget={userWidget}
                    onUpdate={handleUpdateWidget}
                    onRemove={handleRemoveWidget}
                    onEdit={handleEditWidget}
                  />
                </div>
              ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed border-muted-foreground/25 rounded-lg">
            <LayoutDashboard className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Your dashboard is empty</h3>
            <p className="text-muted-foreground mb-4">
              Add widgets to customize your dashboard and track what matters most to you.
            </p>
            <Button onClick={() => setShowWidgetSelector(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Your First Widget
            </Button>
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <LayoutDashboard className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No dashboard selected</h3>
          <p className="text-muted-foreground mb-4">
            Create or select a dashboard to get started.
          </p>
          <Button onClick={() => setShowDashboardManager(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create Dashboard
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <WidgetSelector
        open={showWidgetSelector}
        onOpenChange={setShowWidgetSelector}
        onWidgetSelect={handleAddWidget}
      />

      <DashboardManager
        open={showDashboardManager}
        onOpenChange={setShowDashboardManager}
        onDashboardSelect={handleDashboardSelect}
        currentDashboard={currentDashboard || undefined}
      />
    </div>
  );
}


import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  RefreshCw,
  Plus,
  ChevronDown,
  Settings,
  Trash2,
  Edit,
  LayoutGrid
} from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { toast } from "sonner";

import { Dashboard, DashboardWithWidgets, UserWidget, DashboardWidget } from "./widget-types";
import { DraggableWidget } from "./DraggableWidget";
import { Widget } from "./Widget";
import { WidgetCatalogDialog } from "./WidgetCatalogDialog";
import { dashboardService } from "@/services/dashboard-service";

export default function EnhancedDashboard() {
  const { user, currentTenant } = useAuth();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [currentDashboard, setCurrentDashboard] = useState<DashboardWithWidgets | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWidgetCatalog, setShowWidgetCatalog] = useState(false);
  const [activeWidget, setActiveWidget] = useState<UserWidget | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [widgetToDelete, setWidgetToDelete] = useState<UserWidget | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const fetchDashboards = async () => {
    try {
      const dashboardsData = await dashboardService.getDashboards();
      setDashboards(dashboardsData);
      
      // Load the default dashboard or the first one
      if (dashboardsData.length > 0) {
        const defaultDashboard = dashboardsData.find(d => d.is_default) || dashboardsData[0];
        await loadDashboard(defaultDashboard.dashboard_id);
      }
    } catch (error) {
      console.error("Error fetching dashboards:", error);
      setError("Failed to load dashboards. Please try again.");
      toast.error("Failed to load dashboards");
    }
  };

  const loadDashboard = async (dashboardId: string) => {
    try {
      setIsLoading(true);
      const dashboardData = await dashboardService.getDashboard(dashboardId);
      setCurrentDashboard(dashboardData);
      setError(null);
    } catch (error) {
      console.error("Error loading dashboard:", error);
      setError("Failed to load dashboard. Please try again.");
      toast.error("Failed to load dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const createNewDashboard = async () => {
    try {
      const newDashboard = await dashboardService.createDashboard({
        name: `Dashboard ${dashboards.length + 1}`,
        description: "New dashboard",
        is_default: dashboards.length === 0,
      });
      
      setDashboards(prev => [...prev, newDashboard]);
      await loadDashboard(newDashboard.dashboard_id);
      toast.success("New dashboard created");
    } catch (error) {
      console.error("Error creating dashboard:", error);
      toast.error("Failed to create dashboard");
    }
  };

  const handleAddWidget = async (widget: DashboardWidget) => {
    if (!currentDashboard) return;

    try {
      // Find a good position for the new widget
      const existingWidgets = currentDashboard.widgets;
      let position_x = 0;
      let position_y = 0;

      // Simple positioning logic - place widgets in a grid
      if (existingWidgets.length > 0) {
        const maxY = Math.max(...existingWidgets.map(w => w.position_y + w.height));
        position_y = maxY;
      }

      const newUserWidget = await dashboardService.addWidgetToDashboard(
        currentDashboard.dashboard.dashboard_id,
        {
          widget_id: widget.widget_id,
          position_x,
          position_y,
          width: widget.default_width,
          height: widget.default_height,
        }
      );

      setCurrentDashboard(prev => prev ? {
        ...prev,
        widgets: [...prev.widgets, newUserWidget]
      } : null);

      toast.success("Widget added to dashboard");
    } catch (error) {
      console.error("Error adding widget:", error);
      toast.error("Failed to add widget");
    }
  };

  const handleEditWidget = (userWidget: UserWidget) => {
    // TODO: Implement widget editing dialog
    toast.info("Widget editing coming soon!");
  };

  const handleDeleteWidget = (userWidget: UserWidget) => {
    setWidgetToDelete(userWidget);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteWidget = async () => {
    if (!widgetToDelete || !currentDashboard) return;

    try {
      await dashboardService.removeWidgetFromDashboard(
        currentDashboard.dashboard.dashboard_id,
        widgetToDelete.user_widget_id
      );

      setCurrentDashboard(prev => prev ? {
        ...prev,
        widgets: prev.widgets.filter(w => w.user_widget_id !== widgetToDelete.user_widget_id)
      } : null);

      toast.success("Widget removed from dashboard");
    } catch (error) {
      console.error("Error removing widget:", error);
      toast.error("Failed to remove widget");
    } finally {
      setDeleteDialogOpen(false);
      setWidgetToDelete(null);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const widget = currentDashboard?.widgets.find(w => w.user_widget_id === active.id);
    setActiveWidget(widget || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveWidget(null);

    if (!over || !currentDashboard) return;

    const activeWidget = currentDashboard.widgets.find(w => w.user_widget_id === active.id);
    const overWidget = currentDashboard.widgets.find(w => w.user_widget_id === over.id);

    if (!activeWidget || !overWidget || activeWidget.user_widget_id === overWidget.user_widget_id) {
      return;
    }

    // Simple position swap for now
    try {
      await dashboardService.bulkUpdateWidgetPositions(
        currentDashboard.dashboard.dashboard_id,
        [
          {
            user_widget_id: activeWidget.user_widget_id,
            position_x: overWidget.position_x,
            position_y: overWidget.position_y,
          },
          {
            user_widget_id: overWidget.user_widget_id,
            position_x: activeWidget.position_x,
            position_y: activeWidget.position_y,
          },
        ]
      );

      // Update local state
      setCurrentDashboard(prev => {
        if (!prev) return null;
        
        const updatedWidgets = prev.widgets.map(widget => {
          if (widget.user_widget_id === activeWidget.user_widget_id) {
            return { ...widget, position_x: overWidget.position_x, position_y: overWidget.position_y };
          }
          if (widget.user_widget_id === overWidget.user_widget_id) {
            return { ...widget, position_x: activeWidget.position_x, position_y: activeWidget.position_y };
          }
          return widget;
        });

        return { ...prev, widgets: updatedWidgets };
      });

      toast.success("Widget positions updated");
    } catch (error) {
      console.error("Error updating widget positions:", error);
      toast.error("Failed to update widget positions");
    }
  };

  const handleRefreshDashboard = () => {
    if (currentDashboard) {
      loadDashboard(currentDashboard.dashboard.dashboard_id);
      toast.success("Dashboard refreshed");
    }
  };

  useEffect(() => {
    if (currentTenant) {
      fetchDashboards();
    }
  }, [currentTenant]);

  if (isLoading && !currentDashboard) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !currentDashboard) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10">
          <div className="text-center">
            <h3 className="text-lg font-medium">Error loading dashboard</h3>
            <p className="text-muted-foreground">{error}</p>
            <Button variant="outline" className="mt-4" onClick={fetchDashboards}>
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
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
              <Button variant="outline" className="min-w-[200px] justify-between">
                <span className="truncate">
                  {currentDashboard?.dashboard.name || "Select Dashboard"}
                </span>
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[200px]">
              {dashboards.map((dashboard) => (
                <DropdownMenuItem
                  key={dashboard.dashboard_id}
                  onClick={() => loadDashboard(dashboard.dashboard_id)}
                  className={currentDashboard?.dashboard.dashboard_id === dashboard.dashboard_id ? "bg-accent" : ""}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="truncate">{dashboard.name}</span>
                    {dashboard.is_default && (
                      <span className="text-xs text-muted-foreground ml-2">Default</span>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={createNewDashboard}>
                <Plus className="h-4 w-4 mr-2" />
                Create New Dashboard
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefreshDashboard}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowWidgetCatalog(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Widget
          </Button>
        </div>
      </div>

      {/* Dashboard Content */}
      {currentDashboard ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={currentDashboard.widgets.map(w => w.user_widget_id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-min">
              {currentDashboard.widgets.map((userWidget) => (
                <div
                  key={userWidget.user_widget_id}
                  className={`
                    col-span-${Math.min(userWidget.width, 4)} 
                    row-span-${userWidget.height}
                  `}
                  style={{
                    gridColumn: `span ${Math.min(userWidget.width, 4)}`,
                    minHeight: `${userWidget.height * 200}px`,
                  }}
                >
                  <DraggableWidget
                    userWidget={userWidget}
                    onEdit={handleEditWidget}
                    onDelete={handleDeleteWidget}
                  />
                </div>
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeWidget ? (
              <div className="opacity-90 transform rotate-3 shadow-lg">
                <Widget
                  userWidget={activeWidget}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <LayoutGrid className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No Dashboard Selected</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first dashboard to get started with customizable widgets
            </p>
            <Button onClick={createNewDashboard}>
              <Plus className="h-4 w-4 mr-2" />
              Create Dashboard
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Widget Catalog Dialog */}
      <WidgetCatalogDialog
        open={showWidgetCatalog}
        onOpenChange={setShowWidgetCatalog}
        onAddWidget={handleAddWidget}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Widget</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove "{widgetToDelete?.custom_name || widgetToDelete?.dashboard_widget.name}" from your dashboard?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteWidget} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove Widget
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


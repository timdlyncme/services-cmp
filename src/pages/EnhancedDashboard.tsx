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
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  rectIntersection,
  getFirstCollision,
  pointerWithin
} from '@dnd-kit/core';
import {
  useSortable,
  SortableContext,
  sortableKeyboardCoordinates
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
import { 
  findNextAvailablePosition, 
  findNextAvailablePositionWithReposition,
  checkCollision, 
  gridToPixels, 
  pixelsToGrid,
  GridPosition 
} from '../utils/grid-utils';
import {
  createGridLayout,
  findBestDropPosition,
  getDisplacedWidgets,
  repositionDisplacedWidgets,
  gridToPixels as newGridToPixels,
  pixelsToGrid as newPixelsToGrid,
  GridPosition as NewGridPosition
} from '../utils/grid-layout';

interface SortableWidgetProps {
  userWidget: UserWidget;
  onUpdate: (userWidget: UserWidget) => void;
  onRemove: (userWidgetId: string) => void;
  onConfigureWidget: (userWidget: UserWidget) => void;
  isEditing: boolean;
}

function SortableWidget({ 
  userWidget, 
  onUpdate, 
  onRemove, 
  onConfigureWidget, 
  isEditing 
}: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: userWidget.user_widget_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(isEditing ? listeners : {})}
      className={`${isEditing ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      <BaseWidget
        userWidget={userWidget}
        onUpdate={onUpdate}
        onRemove={onRemove}
        onConfigureWidget={onConfigureWidget}
        isEditing={isEditing}
        className={isEditing ? 'border-dashed border-2 border-primary/20' : ''}
      />
    </div>
  );
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedWidget, setDraggedWidget] = useState<UserWidget | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadDashboards();
  }, []);

  useEffect(() => {
    if (currentDashboardId) {
      loadDashboard(currentDashboardId);
    }
  }, [currentDashboardId]);

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
      // Find the next available position for a 1x1 widget
      const position = findNextAvailablePosition(
        { width: 1, height: 1 },
        currentDashboard.user_widgets
      );

      const newWidget = await dashboardService.addWidgetToDashboard(currentDashboard.dashboard_id, {
        dashboard_id: currentDashboard.dashboard_id,
        widget_id: widgetId,
        custom_name: customName,
        position_x: position.x,
        position_y: position.y,
        width: position.width,
        height: position.height,
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
    if (!configWidget || !currentDashboard) return;

    try {
      let repositionedWidgets: UserWidget[] = [];

      // If size is being changed, check for collisions and reposition if needed
      if ((updates.width !== undefined && updates.width !== configWidget.width) ||
          (updates.height !== undefined && updates.height !== configWidget.height)) {
        
        const newSize = {
          width: updates.width ?? configWidget.width,
          height: updates.height ?? configWidget.height
        };

        const newPosition = {
          x: configWidget.position_x,
          y: configWidget.position_y,
          ...newSize
        };

        // Create current layout
        const currentLayout = createGridLayout(currentDashboard.user_widgets);

        // Get displaced widgets
        const displacedWidgets = getDisplacedWidgets(
          newPosition,
          currentDashboard.user_widgets,
          configWidget.user_widget_id
        );

        // Create new layout with the resized widget
        const updatedWidgets = currentDashboard.user_widgets.map(widget => 
          widget.user_widget_id === configWidget.user_widget_id
            ? { ...widget, ...updates }
            : widget
        );

        // Reposition displaced widgets
        const newLayout = createGridLayout(updatedWidgets);
        repositionedWidgets = repositionDisplacedWidgets(displacedWidgets, newLayout);
      }

      // Update the main widget
      await dashboardService.updateUserWidget(configWidget.user_widget_id, updates);
      
      // Update repositioned widgets
      for (const widget of repositionedWidgets) {
        await dashboardService.updateUserWidget(widget.user_widget_id, {
          position_x: widget.position_x,
          position_y: widget.position_y
        });
      }

      // Update the local state
      setCurrentDashboard(prev => prev ? {
        ...prev,
        user_widgets: prev.user_widgets.map(widget => {
          if (widget.user_widget_id === configWidget.user_widget_id) {
            return { ...widget, ...updates };
          }
          
          // Update repositioned widgets
          const repositioned = repositionedWidgets.find(rw => rw.user_widget_id === widget.user_widget_id);
          if (repositioned) {
            return { ...widget, position_x: repositioned.position_x, position_y: repositioned.position_y };
          }
          
          return widget;
        })
      } : null);

      if (repositionedWidgets.length > 0) {
        toast.success(`Widget resized! ${repositionedWidgets.length} other widget(s) repositioned.`);
      } else {
        toast.success('Widget configuration saved!');
      }
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
        layout_config: currentDashboard.layout_config || {},
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

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id);
    
    const widget = currentDashboard?.user_widgets.find(w => w.user_widget_id === active.id);
    setDraggedWidget(widget || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over, delta } = event;
    
    setActiveId(null);
    setDraggedWidget(null);

    if (!currentDashboard || !active.id) return;

    const draggedWidget = currentDashboard.user_widgets.find(w => w.user_widget_id === active.id);
    if (!draggedWidget) return;

    // Calculate drop position from delta
    const currentPixelPosition = newGridToPixels({
      x: draggedWidget.position_x,
      y: draggedWidget.position_y,
      width: draggedWidget.width,
      height: draggedWidget.height
    });

    const newPixelPosition = {
      x: currentPixelPosition.left + delta.x,
      y: currentPixelPosition.top + delta.y
    };

    // Create current grid layout
    const currentLayout = createGridLayout(currentDashboard.user_widgets);

    // Find best drop position
    const bestPosition = findBestDropPosition(
      draggedWidget,
      newPixelPosition.x,
      newPixelPosition.y,
      currentLayout
    );

    // Check if position actually changed
    if (bestPosition.x === draggedWidget.position_x && bestPosition.y === draggedWidget.position_y) {
      return; // No change needed
    }

    // Get displaced widgets
    const displacedWidgets = getDisplacedWidgets(
      bestPosition,
      currentDashboard.user_widgets,
      draggedWidget.user_widget_id
    );

    // Create new layout with the moved widget
    const updatedWidgets = currentDashboard.user_widgets.map(widget => 
      widget.user_widget_id === draggedWidget.user_widget_id
        ? { ...widget, position_x: bestPosition.x, position_y: bestPosition.y }
        : widget
    );

    // Reposition displaced widgets
    const newLayout = createGridLayout(updatedWidgets);
    const repositionedWidgets = repositionDisplacedWidgets(displacedWidgets, newLayout);

    // Apply all changes
    const finalWidgets = updatedWidgets.map(widget => {
      const repositioned = repositionedWidgets.find(rw => rw.user_widget_id === widget.user_widget_id);
      return repositioned || widget;
    });

    setCurrentDashboard(prev => prev ? {
      ...prev,
      user_widgets: finalWidgets
    } : null);

    // Show feedback
    if (repositionedWidgets.length > 0) {
      toast.success(`Widget moved! ${repositionedWidgets.length} other widget(s) repositioned.`);
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={currentDashboard.user_widgets.map(w => w.user_widget_id)}
          >
            <div className="relative min-h-screen">
              {currentDashboard.user_widgets
                .filter(widget => widget.is_visible)
                .map((userWidget) => {
                  const pixelPosition = newGridToPixels({
                    x: userWidget.position_x,
                    y: userWidget.position_y,
                    width: userWidget.width,
                    height: userWidget.height
                  });

                  return (
                    <div
                      key={userWidget.user_widget_id}
                      className="absolute"
                      style={{
                        left: `${pixelPosition.left}px`,
                        top: `${pixelPosition.top}px`,
                        width: `${pixelPosition.width}px`,
                        height: `${pixelPosition.height}px`,
                      }}
                    >
                      <SortableWidget
                        userWidget={userWidget}
                        onUpdate={handleUpdateWidget}
                        onRemove={handleRemoveWidget}
                        onConfigureWidget={handleConfigureWidget}
                        isEditing={isEditing}
                      />
                    </div>
                  );
                })}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeId && draggedWidget ? (
              <BaseWidget
                userWidget={draggedWidget}
                isEditing={false}
                className="opacity-90 rotate-3 shadow-lg"
              />
            ) : null}
          </DragOverlay>
        </DndContext>
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

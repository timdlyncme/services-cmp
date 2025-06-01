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
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import BaseWidget from '@/components/dashboard/BaseWidget';
import WidgetCatalog from '@/components/dashboard/WidgetCatalog';
import DashboardManager from '@/components/dashboard/DashboardManager';
import { 
  Dashboard, 
  DashboardWithWidgets, 
  UserWidget, 
  dashboardService,
  CreateUserWidgetRequest 
} from '@/services/dashboard-service';

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
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showWidgetCatalog, setShowWidgetCatalog] = useState(false);
  const [showDashboardManager, setShowDashboardManager] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedWidget, setDraggedWidget] = useState<UserWidget | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    if (currentTenant) {
      loadDashboards();
    }
  }, [currentTenant]);

  const loadDashboards = async () => {
    try {
      setIsLoading(true);
      const userDashboards = await dashboardService.getDashboards();
      setDashboards(userDashboards);
      
      // Load the default dashboard or the first one
      if (userDashboards.length > 0) {
        const defaultDashboard = userDashboards.find(d => d.is_default) || userDashboards[0];
        await loadDashboard(defaultDashboard.dashboard_id);
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
      const dashboard = await dashboardService.getDashboard(dashboardId);
      setCurrentDashboard(dashboard);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast.error('Failed to load dashboard');
    }
  };

  const handleDashboardChange = (dashboardId: string) => {
    loadDashboard(dashboardId);
  };

  const handleDashboardSelect = (dashboard: Dashboard) => {
    loadDashboard(dashboard.dashboard_id);
  };

  const handleAddWidget = async (widgetId: string, customName?: string) => {
    if (!currentDashboard) return;

    try {
      // Find a good position for the new widget
      const existingWidgets = currentDashboard.user_widgets;
      const maxY = Math.max(0, ...existingWidgets.map(w => w.position_y + w.height));
      
      const newWidget: CreateUserWidgetRequest = {
        dashboard_id: currentDashboard.dashboard_id,
        widget_id: widgetId,
        custom_name: customName,
        position_x: 0,
        position_y: maxY,
        width: 1,
        height: 1,
        is_visible: true
      };

      const addedWidget = await dashboardService.addWidgetToDashboard(
        currentDashboard.dashboard_id,
        newWidget
      );

      setCurrentDashboard(prev => prev ? {
        ...prev,
        user_widgets: [...prev.user_widgets, addedWidget]
      } : null);

      toast.success('Widget added to dashboard');
    } catch (error) {
      console.error('Error adding widget:', error);
      toast.error('Failed to add widget');
    }
  };

  const handleUpdateWidget = (updatedWidget: UserWidget) => {
    setCurrentDashboard(prev => prev ? {
      ...prev,
      user_widgets: prev.user_widgets.map(w => 
        w.user_widget_id === updatedWidget.user_widget_id ? updatedWidget : w
      )
    } : null);
  };

  const handleRemoveWidget = async (userWidgetId: string) => {
    try {
      await dashboardService.removeWidgetFromDashboard(userWidgetId);
      
      setCurrentDashboard(prev => prev ? {
        ...prev,
        user_widgets: prev.user_widgets.filter(w => w.user_widget_id !== userWidgetId)
      } : null);

      toast.success('Widget removed from dashboard');
    } catch (error) {
      console.error('Error removing widget:', error);
      toast.error('Failed to remove widget');
    }
  };

  const handleConfigureWidget = (userWidget: UserWidget) => {
    // TODO: Implement widget configuration dialog
    toast.info('Widget configuration coming soon!');
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
    setActiveId(active.id as string);
    
    const widget = currentDashboard?.user_widgets.find(w => w.user_widget_id === active.id);
    setDraggedWidget(widget || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (active.id !== over?.id && currentDashboard) {
      const oldIndex = currentDashboard.user_widgets.findIndex(w => w.user_widget_id === active.id);
      const newIndex = currentDashboard.user_widgets.findIndex(w => w.user_widget_id === over?.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newWidgets = [...currentDashboard.user_widgets];
        const [movedWidget] = newWidgets.splice(oldIndex, 1);
        newWidgets.splice(newIndex, 0, movedWidget);
        
        // Update positions based on new order
        const updatedWidgets = newWidgets.map((widget, index) => ({
          ...widget,
          position_y: Math.floor(index / 3), // Assuming 3 columns
          position_x: index % 3
        }));
        
        setCurrentDashboard(prev => prev ? {
          ...prev,
          user_widgets: updatedWidgets
        } : null);
      }
    }
    
    setActiveId(null);
    setDraggedWidget(null);
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
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {currentDashboard.user_widgets
                .filter(widget => widget.is_visible)
                .map((userWidget) => (
                  <SortableWidget
                    key={userWidget.user_widget_id}
                    userWidget={userWidget}
                    onUpdate={handleUpdateWidget}
                    onRemove={handleRemoveWidget}
                    onConfigureWidget={handleConfigureWidget}
                    isEditing={isEditing}
                  />
                ))}
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

      <DashboardManager
        isOpen={showDashboardManager}
        onClose={() => setShowDashboardManager(false)}
        onDashboardSelect={handleDashboardSelect}
        currentDashboard={currentDashboard || undefined}
      />
    </div>
  );
}

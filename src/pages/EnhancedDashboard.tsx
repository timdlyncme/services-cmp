import React, { useState, useEffect } from 'react';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent } from '@/components/ui/card';
import { 
  RefreshCw, 
  Plus, 
  MoreHorizontal, 
  Settings, 
  Trash2,
  LayoutDashboard
} from 'lucide-react';
import { toast } from 'sonner';

import { 
  dashboardService, 
  Dashboard, 
  DashboardListItem, 
  DashboardWidget 
} from '@/services/dashboard-service';
import { WidgetRenderer } from '@/components/dashboard/WidgetRenderer';
import { AddWidgetDialog } from '@/components/dashboard/AddWidgetDialog';
import { CreateDashboardDialog } from '@/components/dashboard/CreateDashboardDialog';

export default function EnhancedDashboard() {
  const { user, currentTenant } = useAuth();
  const [dashboards, setDashboards] = useState<DashboardListItem[]>([]);
  const [currentDashboard, setCurrentDashboard] = useState<Dashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Dialog states
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showCreateDashboard, setShowCreateDashboard] = useState(false);

  useEffect(() => {
    if (currentTenant) {
      loadDashboards();
    }
  }, [currentTenant]);

  const loadDashboards = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const dashboardList = await dashboardService.getDashboards();
      setDashboards(dashboardList);

      // Load default dashboard or first available
      if (dashboardList.length > 0) {
        const defaultDashboard = dashboardList.find(d => d.is_default) || dashboardList[0];
        await loadDashboard(defaultDashboard.dashboard_id);
      } else {
        // No dashboards exist, create a default one
        await createDefaultDashboard();
      }
    } catch (error) {
      console.error('Error loading dashboards:', error);
      setError('Failed to load dashboards');
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

  const createDefaultDashboard = async () => {
    try {
      const defaultDashboard = await dashboardService.createDashboard({
        name: 'Main Dashboard',
        description: 'Your main dashboard with key metrics',
        is_default: true
      });

      // Create some default widgets
      const defaultWidgets = [
        {
          title: 'Total Deployments',
          widget_type: 'metric',
          data_source: 'deployments',
          position_x: 0,
          position_y: 0,
          width: 1,
          height: 1
        },
        {
          title: 'Cloud Accounts',
          widget_type: 'metric',
          data_source: 'cloud_accounts',
          position_x: 1,
          position_y: 0,
          width: 1,
          height: 1
        },
        {
          title: 'Recent Deployments',
          widget_type: 'list',
          data_source: 'deployments',
          position_x: 0,
          position_y: 1,
          width: 2,
          height: 2
        },
        {
          title: 'Deployments by Provider',
          widget_type: 'chart',
          data_source: 'deployments',
          position_x: 2,
          position_y: 0,
          width: 2,
          height: 2
        }
      ];

      for (const widget of defaultWidgets) {
        await dashboardService.createWidget(defaultDashboard.dashboard_id, widget);
      }

      await loadDashboards();
      toast.success('Default dashboard created');
    } catch (error) {
      console.error('Error creating default dashboard:', error);
      toast.error('Failed to create default dashboard');
    }
  };

  const handleDashboardChange = async (dashboardId: string) => {
    await loadDashboard(dashboardId);
  };

  const handleRefreshDashboard = async () => {
    if (!currentDashboard) return;

    setIsRefreshing(true);
    try {
      await loadDashboard(currentDashboard.dashboard_id);
      toast.success('Dashboard refreshed');
    } catch (error) {
      toast.error('Failed to refresh dashboard');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleWidgetCreated = async () => {
    if (currentDashboard) {
      await loadDashboard(currentDashboard.dashboard_id);
    }
  };

  const handleWidgetEdit = (widget: DashboardWidget) => {
    // TODO: Implement widget edit dialog
    toast.info('Widget editing coming soon');
  };

  const handleWidgetDelete = async (widget: DashboardWidget) => {
    if (!currentDashboard) return;

    try {
      await dashboardService.deleteWidget(currentDashboard.dashboard_id, widget.widget_id);
      await loadDashboard(currentDashboard.dashboard_id);
      toast.success('Widget removed');
    } catch (error) {
      console.error('Error deleting widget:', error);
      toast.error('Failed to remove widget');
    }
  };

  const handleDashboardCreated = async () => {
    await loadDashboards();
  };

  const handleDeleteDashboard = async () => {
    if (!currentDashboard) return;

    try {
      await dashboardService.deleteDashboard(currentDashboard.dashboard_id);
      await loadDashboards();
      toast.success('Dashboard deleted');
    } catch (error) {
      console.error('Error deleting dashboard:', error);
      toast.error('Failed to delete dashboard');
    }
  };

  const renderWidgetGrid = () => {
    if (!currentDashboard || !currentDashboard.widgets) {
      return (
        <Card className="col-span-full">
          <CardContent className="flex flex-col items-center justify-center py-10">
            <LayoutDashboard className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No widgets yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add your first widget to get started with your dashboard
            </p>
            <Button onClick={() => setShowAddWidget(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Widget
            </Button>
          </CardContent>
        </Card>
      );
    }

    const activeWidgets = currentDashboard.widgets.filter(w => w.is_active);

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {activeWidgets.map((widget) => (
          <div
            key={widget.widget_id}
            className={`col-span-${widget.width} row-span-${widget.height}`}
            style={{
              gridColumn: `span ${widget.width}`,
              gridRow: `span ${widget.height}`
            }}
          >
            <WidgetRenderer
              widget={widget}
              onEdit={handleWidgetEdit}
              onDelete={handleWidgetDelete}
            />
          </div>
        ))}
      </div>
    );
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
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-10">
          <h3 className="text-lg font-medium mb-2">Error loading dashboard</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button variant="outline" onClick={loadDashboards}>
            Try Again
          </Button>
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
          {dashboards.length > 0 && (
            <div className="flex items-center gap-2">
              <Select
                value={currentDashboard?.dashboard_id || ''}
                onValueChange={handleDashboardChange}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select dashboard" />
                </SelectTrigger>
                <SelectContent>
                  {dashboards.map((dashboard) => (
                    <SelectItem key={dashboard.dashboard_id} value={dashboard.dashboard_id}>
                      <div className="flex items-center gap-2">
                        <span>{dashboard.name}</span>
                        {dashboard.is_default && (
                          <span className="text-xs bg-primary/10 text-primary px-1 rounded">
                            Default
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateDashboard(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddWidget(true)}
            disabled={!currentDashboard}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Widget
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshDashboard}
            disabled={isRefreshing || !currentDashboard}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>

          {currentDashboard && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => toast.info('Dashboard settings coming soon')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Dashboard Settings
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleDeleteDashboard}
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
      {renderWidgetGrid()}

      {/* Dialogs */}
      <AddWidgetDialog
        open={showAddWidget}
        onOpenChange={setShowAddWidget}
        dashboardId={currentDashboard?.dashboard_id || ''}
        onWidgetCreated={handleWidgetCreated}
      />

      <CreateDashboardDialog
        open={showCreateDashboard}
        onOpenChange={setShowCreateDashboard}
        onDashboardCreated={handleDashboardCreated}
      />
    </div>
  );
}


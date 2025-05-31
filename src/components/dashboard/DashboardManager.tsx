import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Star, 
  StarOff,
  LayoutDashboard,
  AlertCircle
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dashboard, dashboardService, CreateDashboardRequest, UpdateDashboardRequest } from '@/services/dashboard-service';
import { toast } from 'sonner';

interface DashboardManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDashboardSelect: (dashboard: Dashboard) => void;
  currentDashboard?: Dashboard;
}

export default function DashboardManager({ 
  open, 
  onOpenChange, 
  onDashboardSelect, 
  currentDashboard 
}: DashboardManagerProps) {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null);
  const [deleteConfirmDashboard, setDeleteConfirmDashboard] = useState<Dashboard | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_default: false
  });

  useEffect(() => {
    if (open) {
      fetchDashboards();
    }
  }, [open]);

  const fetchDashboards = async () => {
    setIsLoading(true);
    try {
      const userDashboards = await dashboardService.getUserDashboards();
      setDashboards(userDashboards);
    } catch (error) {
      console.error('Error fetching dashboards:', error);
      toast.error('Failed to load dashboards');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateDashboard = async () => {
    if (!formData.name.trim()) {
      toast.error('Dashboard name is required');
      return;
    }

    try {
      const newDashboard = await dashboardService.createDashboard(formData as CreateDashboardRequest);
      setDashboards([...dashboards, newDashboard]);
      setShowCreateForm(false);
      setFormData({ name: '', description: '', is_default: false });
      toast.success('Dashboard created successfully');
    } catch (error) {
      console.error('Error creating dashboard:', error);
      toast.error('Failed to create dashboard');
    }
  };

  const handleUpdateDashboard = async () => {
    if (!editingDashboard || !formData.name.trim()) {
      toast.error('Dashboard name is required');
      return;
    }

    try {
      const updatedDashboard = await dashboardService.updateDashboard(
        editingDashboard.dashboard_id,
        formData as UpdateDashboardRequest
      );
      
      setDashboards(dashboards.map(d => 
        d.id === updatedDashboard.id ? updatedDashboard : d
      ));
      setEditingDashboard(null);
      setFormData({ name: '', description: '', is_default: false });
      toast.success('Dashboard updated successfully');
    } catch (error) {
      console.error('Error updating dashboard:', error);
      toast.error('Failed to update dashboard');
    }
  };

  const handleDeleteDashboard = async (dashboard: Dashboard) => {
    try {
      await dashboardService.deleteDashboard(dashboard.dashboard_id);
      setDashboards(dashboards.filter(d => d.id !== dashboard.id));
      setDeleteConfirmDashboard(null);
      toast.success('Dashboard deleted successfully');
      
      // If we deleted the current dashboard, select another one
      if (currentDashboard?.id === dashboard.id && dashboards.length > 1) {
        const remainingDashboards = dashboards.filter(d => d.id !== dashboard.id);
        const defaultDashboard = remainingDashboards.find(d => d.is_default) || remainingDashboards[0];
        onDashboardSelect(defaultDashboard);
      }
    } catch (error) {
      console.error('Error deleting dashboard:', error);
      toast.error('Failed to delete dashboard');
    }
  };

  const startEdit = (dashboard: Dashboard) => {
    setEditingDashboard(dashboard);
    setFormData({
      name: dashboard.name,
      description: dashboard.description || '',
      is_default: dashboard.is_default
    });
    setShowCreateForm(true);
  };

  const cancelForm = () => {
    setShowCreateForm(false);
    setEditingDashboard(null);
    setFormData({ name: '', description: '', is_default: false });
  };

  const renderDashboardCard = (dashboard: Dashboard) => (
    <Card 
      key={dashboard.id}
      className={`cursor-pointer transition-all ${
        currentDashboard?.id === dashboard.id 
          ? 'ring-2 ring-primary' 
          : 'hover:shadow-md'
      }`}
      onClick={() => {
        onDashboardSelect(dashboard);
        onOpenChange(false);
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">{dashboard.name}</CardTitle>
            {dashboard.is_default && (
              <Star className="h-4 w-4 text-yellow-500 fill-current" />
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                startEdit(dashboard);
              }}
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteConfirmDashboard(dashboard);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {dashboard.description && (
          <CardDescription className="text-sm">
            {dashboard.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{dashboard.user_widgets.length} widgets</span>
          <Badge variant={dashboard.is_default ? "default" : "outline"} className="text-xs">
            {dashboard.is_default ? 'Default' : 'Custom'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Manage Dashboards</DialogTitle>
            <DialogDescription>
              Create, edit, and organize your custom dashboards.
            </DialogDescription>
          </DialogHeader>

          {showCreateForm ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Dashboard Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter dashboard name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Enter dashboard description"
                  rows={3}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="is_default"
                  checked={formData.is_default}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
                />
                <Label htmlFor="is_default">Set as default dashboard</Label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={cancelForm}>
                  Cancel
                </Button>
                <Button onClick={editingDashboard ? handleUpdateDashboard : handleCreateDashboard}>
                  {editingDashboard ? 'Update Dashboard' : 'Create Dashboard'}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Your Dashboards</h3>
                <Button onClick={() => setShowCreateForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Dashboard
                </Button>
              </div>

              <div className="overflow-y-auto max-h-[50vh]">
                {isLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="text-center">
                      <LayoutDashboard className="h-8 w-8 animate-pulse mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Loading dashboards...</p>
                    </div>
                  </div>
                ) : dashboards.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    {dashboards.map(renderDashboardCard)}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-32 text-center">
                    <LayoutDashboard className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      No dashboards found
                    </p>
                    <Button variant="outline" onClick={() => setShowCreateForm(true)}>
                      Create your first dashboard
                    </Button>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteConfirmDashboard} onOpenChange={() => setDeleteConfirmDashboard(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Dashboard</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirmDashboard?.name}"? This action cannot be undone.
              All widgets and customizations will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirmDashboard && handleDeleteDashboard(deleteConfirmDashboard)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Dashboard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}


import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
  Calendar,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dashboard, dashboardService, CreateDashboardRequest, UpdateDashboardRequest } from '@/services/dashboard-service';
import { toast } from 'sonner';

interface DashboardManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onDashboardSelect: (dashboard: Dashboard) => void;
  currentDashboard?: Dashboard;
}

interface DashboardFormData {
  name: string;
  description: string;
  is_default: boolean;
}

export default function DashboardManager({ 
  isOpen, 
  onClose, 
  onDashboardSelect, 
  currentDashboard 
}: DashboardManagerProps) {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(null);
  const [formData, setFormData] = useState<DashboardFormData>({
    name: '',
    description: '',
    is_default: false
  });

  useEffect(() => {
    if (isOpen) {
      fetchDashboards();
    }
  }, [isOpen]);

  const fetchDashboards = async () => {
    try {
      setIsLoading(true);
      const userDashboards = await dashboardService.getDashboards();
      setDashboards(userDashboards);
    } catch (error) {
      console.error('Error fetching dashboards:', error);
      toast.error('Failed to load dashboards');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateDashboard = () => {
    setFormData({
      name: '',
      description: '',
      is_default: false
    });
    setEditingDashboard(null);
    setShowCreateForm(true);
  };

  const handleEditDashboard = (dashboard: Dashboard) => {
    setFormData({
      name: dashboard.name,
      description: dashboard.description || '',
      is_default: dashboard.is_default
    });
    setEditingDashboard(dashboard);
    setShowCreateForm(true);
  };

  const handleSubmitForm = async () => {
    if (!formData.name.trim()) {
      toast.error('Dashboard name is required');
      return;
    }

    try {
      if (editingDashboard) {
        // Update existing dashboard
        const updateData: UpdateDashboardRequest = {
          name: formData.name,
          description: formData.description || undefined,
          is_default: formData.is_default
        };
        
        const updatedDashboard = await dashboardService.updateDashboard(
          editingDashboard.dashboard_id,
          updateData
        );
        
        setDashboards(prev => 
          prev.map(d => d.dashboard_id === updatedDashboard.dashboard_id ? updatedDashboard : d)
        );
        
        toast.success('Dashboard updated successfully');
      } else {
        // Create new dashboard
        const createData: CreateDashboardRequest = {
          name: formData.name,
          description: formData.description || undefined,
          is_default: formData.is_default
        };
        
        const newDashboard = await dashboardService.createDashboard(createData);
        setDashboards(prev => [...prev, newDashboard]);
        
        toast.success('Dashboard created successfully');
        
        // If this is set as default or it's the first dashboard, select it
        if (newDashboard.is_default || dashboards.length === 0) {
          onDashboardSelect(newDashboard);
        }
      }
      
      setShowCreateForm(false);
      setEditingDashboard(null);
    } catch (error) {
      console.error('Error saving dashboard:', error);
      toast.error('Failed to save dashboard');
    }
  };

  const handleDeleteDashboard = async (dashboard: Dashboard) => {
    if (!window.confirm(`Are you sure you want to delete \"${dashboard.name}\"?`)) {
      return;
    }

    try {
      await dashboardService.deleteDashboard(dashboard.dashboard_id);
      setDashboards(prev => prev.filter(d => d.dashboard_id !== dashboard.dashboard_id));
      
      // If we deleted the current dashboard, select the first available one
      if (currentDashboard?.dashboard_id === dashboard.dashboard_id) {
        const remaining = dashboards.filter(d => d.dashboard_id !== dashboard.dashboard_id);
        if (remaining.length > 0) {
          onDashboardSelect(remaining[0]);
        }
      }
      
      toast.success('Dashboard deleted successfully');
    } catch (error) {
      console.error('Error deleting dashboard:', error);
      toast.error('Failed to delete dashboard');
    }
  };

  const handleSetDefault = async (dashboard: Dashboard) => {
    try {
      const updatedDashboard = await dashboardService.updateDashboard(
        dashboard.dashboard_id,
        { is_default: true }
      );
      
      // Update the dashboards list
      setDashboards(prev => 
        prev.map(d => ({
          ...d,
          is_default: d.dashboard_id === updatedDashboard.dashboard_id
        }))
      );
      
      toast.success('Default dashboard updated');
    } catch (error) {
      console.error('Error setting default dashboard:', error);
      toast.error('Failed to set default dashboard');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Dashboard Manager</DialogTitle>
          <DialogDescription>
            Create, edit, and manage your dashboards
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          {/* Create Dashboard Button */}
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">Your Dashboards</h3>
            <Button onClick={handleCreateDashboard}>
              <Plus className="h-4 w-4 mr-2" />
              New Dashboard
            </Button>
          </div>

          {/* Dashboards List */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : dashboards.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <Plus className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No dashboards yet</p>
                <p className="text-sm text-muted-foreground">Create your first dashboard to get started</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {dashboards.map((dashboard) => (
                  <Card
                    key={dashboard.dashboard_id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      currentDashboard?.dashboard_id === dashboard.dashboard_id ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => onDashboardSelect(dashboard)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-sm font-medium truncate">
                              {dashboard.name}
                            </CardTitle>
                            {dashboard.is_default && (
                              <Badge variant="secondary" className="text-xs">
                                <Star className="h-3 w-3 mr-1" />
                                Default
                              </Badge>
                            )}
                          </div>
                          {dashboard.description && (
                            <CardDescription className="text-xs mt-1 line-clamp-2">
                              {dashboard.description}
                            </CardDescription>
                          )}
                        </div>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              handleEditDashboard(dashboard);
                            }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            {!dashboard.is_default && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                handleSetDefault(dashboard);
                              }}>
                                <Star className="h-4 w-4 mr-2" />
                                Set as Default
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteDashboard(dashboard);
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(dashboard.date_created)}
                        </span>
                        {currentDashboard?.dashboard_id === dashboard.dashboard_id && (
                          <Badge variant="outline" className="text-xs">
                            Current
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>

      {/* Create/Edit Dashboard Form */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDashboard ? 'Edit Dashboard' : 'Create New Dashboard'}
            </DialogTitle>
            <DialogDescription>
              {editingDashboard 
                ? 'Update your dashboard settings' 
                : 'Create a new dashboard to organize your widgets'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter dashboard name"
              />
            </div>

            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter dashboard description"
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_default"
                checked={formData.is_default}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_default: checked }))}
              />
              <Label htmlFor="is_default">Set as default dashboard</Label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowCreateForm(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitForm}>
              {editingDashboard ? 'Update' : 'Create'} Dashboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

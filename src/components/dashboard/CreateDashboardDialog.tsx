import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { dashboardService, CreateDashboardRequest } from '@/services/dashboard-service';
import { toast } from 'sonner';

interface CreateDashboardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDashboardCreated: () => void;
}

export function CreateDashboardDialog({
  open,
  onOpenChange,
  onDashboardCreated
}: CreateDashboardDialogProps) {
  const [formData, setFormData] = useState<CreateDashboardRequest>({
    name: '',
    description: '',
    is_default: false
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast.error('Dashboard name is required');
      return;
    }

    setIsLoading(true);

    try {
      await dashboardService.createDashboard(formData);
      toast.success('Dashboard created successfully');
      onDashboardCreated();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error creating dashboard:', error);
      toast.error('Failed to create dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      is_default: false
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Dashboard</DialogTitle>
          <DialogDescription>
            Create a new dashboard to organize your widgets.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Dashboard Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter dashboard name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter dashboard description (optional)"
              rows={3}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is_default"
              checked={formData.is_default}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, is_default: checked as boolean }))
              }
            />
            <Label htmlFor="is_default" className="text-sm">
              Set as default dashboard
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Creating...' : 'Create Dashboard'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


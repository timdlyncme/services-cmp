import React, { useState, useEffect } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { dashboardService, WidgetType, CreateWidgetRequest } from '@/services/dashboard-service';
import { toast } from 'sonner';
import { BarChart3, PieChart, List, Table, Activity } from 'lucide-react';

interface AddWidgetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboardId: string;
  onWidgetCreated: () => void;
}

const WIDGET_ICONS = {
  metric: BarChart3,
  chart: PieChart,
  list: List,
  table: Table,
  status: Activity
};

const DATA_SOURCES = [
  { value: 'deployments', label: 'Deployments' },
  { value: 'cloud_accounts', label: 'Cloud Accounts' },
  { value: 'templates', label: 'Templates' },
  { value: 'environments', label: 'Environments' }
];

export function AddWidgetDialog({
  open,
  onOpenChange,
  dashboardId,
  onWidgetCreated
}: AddWidgetDialogProps) {
  const [widgetTypes, setWidgetTypes] = useState<WidgetType[]>([]);
  const [selectedType, setSelectedType] = useState<WidgetType | null>(null);
  const [formData, setFormData] = useState<CreateWidgetRequest>({
    title: '',
    widget_type: '',
    data_source: '',
    configuration: {},
    position_x: 0,
    position_y: 0,
    width: 1,
    height: 1,
    refresh_interval: 300
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchWidgetTypes();
    }
  }, [open]);

  const fetchWidgetTypes = async () => {
    try {
      const types = await dashboardService.getWidgetTypes();
      setWidgetTypes(types);
    } catch (error) {
      console.error('Error fetching widget types:', error);
      toast.error('Failed to load widget types');
    }
  };

  const handleTypeSelect = (type: WidgetType) => {
    setSelectedType(type);
    setFormData(prev => ({
      ...prev,
      widget_type: type.type_name,
      configuration: type.default_config || {}
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.widget_type || !formData.data_source) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsLoading(true);

    try {
      await dashboardService.createWidget(dashboardId, formData);
      toast.success('Widget created successfully');
      onWidgetCreated();
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Error creating widget:', error);
      toast.error('Failed to create widget');
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      widget_type: '',
      data_source: '',
      configuration: {},
      position_x: 0,
      position_y: 0,
      width: 1,
      height: 1,
      refresh_interval: 300
    });
    setSelectedType(null);
  };

  const getAvailableDataSources = () => {
    if (!selectedType || !selectedType.data_sources) {
      return DATA_SOURCES;
    }
    return DATA_SOURCES.filter(source => 
      selectedType.data_sources!.includes(source.value)
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Widget</DialogTitle>
          <DialogDescription>
            Choose a widget type and configure it for your dashboard.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Widget Type Selection */}
          <div className="space-y-3">
            <Label>Widget Type</Label>
            <div className="grid grid-cols-2 gap-3">
              {widgetTypes.map((type) => {
                const IconComponent = WIDGET_ICONS[type.type_name as keyof typeof WIDGET_ICONS] || BarChart3;
                return (
                  <Card
                    key={type.id}
                    className={`cursor-pointer transition-colors ${
                      selectedType?.id === type.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => handleTypeSelect(type)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <IconComponent className="h-4 w-4" />
                        <CardTitle className="text-sm">{type.display_name}</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <CardDescription className="text-xs">
                        {type.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {selectedType && (
            <>
              {/* Widget Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Widget Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter widget title"
                  required
                />
              </div>

              {/* Data Source */}
              <div className="space-y-2">
                <Label htmlFor="data_source">Data Source *</Label>
                <Select
                  value={formData.data_source}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, data_source: value }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select data source" />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableDataSources().map((source) => (
                      <SelectItem key={source.value} value={source.value}>
                        {source.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Widget Size */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="width">Width</Label>
                  <Select
                    value={formData.width.toString()}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, width: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Column</SelectItem>
                      <SelectItem value="2">2 Columns</SelectItem>
                      <SelectItem value="3">3 Columns</SelectItem>
                      <SelectItem value="4">4 Columns</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="height">Height</Label>
                  <Select
                    value={formData.height.toString()}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, height: parseInt(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 Row</SelectItem>
                      <SelectItem value="2">2 Rows</SelectItem>
                      <SelectItem value="3">3 Rows</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Refresh Interval */}
              <div className="space-y-2">
                <Label htmlFor="refresh_interval">Refresh Interval</Label>
                <Select
                  value={formData.refresh_interval.toString()}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, refresh_interval: parseInt(value) }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Manual only</SelectItem>
                    <SelectItem value="60">1 minute</SelectItem>
                    <SelectItem value="300">5 minutes</SelectItem>
                    <SelectItem value="600">10 minutes</SelectItem>
                    <SelectItem value="1800">30 minutes</SelectItem>
                    <SelectItem value="3600">1 hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!selectedType || isLoading}
            >
              {isLoading ? 'Creating...' : 'Create Widget'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


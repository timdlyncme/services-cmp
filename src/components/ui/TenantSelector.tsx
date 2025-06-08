import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Plus, Building2 } from 'lucide-react';
import { cmpService } from '@/services/cmp-service';
import { Tenant } from '@/types/auth';
import { toast } from 'sonner';

export interface TenantAssignment {
  tenant_id: string;
  role: string;
  is_primary: boolean;
}

interface TenantSelectorProps {
  value: TenantAssignment[];
  onChange: (assignments: TenantAssignment[]) => void;
  availableRoles?: string[];
  disabled?: boolean;
  className?: string;
}

const TenantSelector: React.FC<TenantSelectorProps> = ({
  value = [],
  onChange,
  availableRoles = ['user', 'admin'],
  disabled = false,
  className = ''
}) => {
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('user');

  // Fetch available tenants on component mount
  useEffect(() => {
    const fetchAvailableTenants = async () => {
      try {
        setIsLoading(true);
        const tenants = await cmpService.getAvailableTenants();
        setAvailableTenants(tenants);
      } catch (error) {
        console.error('Error fetching available tenants:', error);
        toast.error('Failed to load available tenants');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAvailableTenants();
  }, []);

  // Get tenants that are not already assigned
  const unassignedTenants = availableTenants.filter(
    tenant => !value.some(assignment => assignment.tenant_id === tenant.tenant_id)
  );

  // Add a new tenant assignment
  const handleAddAssignment = () => {
    if (!selectedTenantId) {
      toast.error('Please select a tenant');
      return;
    }

    const newAssignment: TenantAssignment = {
      tenant_id: selectedTenantId,
      role: selectedRole,
      is_primary: value.length === 0 // First assignment is primary by default
    };

    onChange([...value, newAssignment]);
    setSelectedTenantId('');
    setSelectedRole('user');
  };

  // Remove a tenant assignment
  const handleRemoveAssignment = (tenantId: string) => {
    const updatedAssignments = value.filter(assignment => assignment.tenant_id !== tenantId);
    
    // If we removed the primary assignment, make the first remaining one primary
    if (updatedAssignments.length > 0 && !updatedAssignments.some(a => a.is_primary)) {
      updatedAssignments[0].is_primary = true;
    }
    
    onChange(updatedAssignments);
  };

  // Update role for an assignment
  const handleRoleChange = (tenantId: string, newRole: string) => {
    const updatedAssignments = value.map(assignment =>
      assignment.tenant_id === tenantId
        ? { ...assignment, role: newRole }
        : assignment
    );
    onChange(updatedAssignments);
  };

  // Set primary tenant
  const handleSetPrimary = (tenantId: string) => {
    const updatedAssignments = value.map(assignment => ({
      ...assignment,
      is_primary: assignment.tenant_id === tenantId
    }));
    onChange(updatedAssignments);
  };

  // Get tenant name by ID
  const getTenantName = (tenantId: string): string => {
    const tenant = availableTenants.find(t => t.tenant_id === tenantId);
    return tenant ? tenant.name : tenantId;
  };

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div>
        <label className="text-sm font-medium mb-2 block">Tenant Assignments</label>
        
        {/* Current assignments */}
        {value.length > 0 && (
          <div className="space-y-2 mb-4">
            {value.map((assignment) => (
              <Card key={assignment.tenant_id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{getTenantName(assignment.tenant_id)}</span>
                        {assignment.is_primary && (
                          <Badge variant="default" className="text-xs">Primary</Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Role: {assignment.role}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {/* Role selector */}
                    <Select
                      value={assignment.role}
                      onValueChange={(newRole) => handleRoleChange(assignment.tenant_id, newRole)}
                      disabled={disabled}
                    >
                      <SelectTrigger className="w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRoles.map((role) => (
                          <SelectItem key={role} value={role}>
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    {/* Primary button */}
                    {!assignment.is_primary && value.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetPrimary(assignment.tenant_id)}
                        disabled={disabled}
                      >
                        Set Primary
                      </Button>
                    )}
                    
                    {/* Remove button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAssignment(assignment.tenant_id)}
                      disabled={disabled || value.length === 1} // Prevent removing the last assignment
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Add new assignment */}
        {unassignedTenants.length > 0 && (
          <Card className="p-3">
            <div className="flex items-center space-x-3">
              <div className="flex-1">
                <Select
                  value={selectedTenantId}
                  onValueChange={setSelectedTenantId}
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a tenant..." />
                  </SelectTrigger>
                  <SelectContent>
                    {unassignedTenants.map((tenant) => (
                      <SelectItem key={tenant.tenant_id} value={tenant.tenant_id}>
                        {tenant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="w-32">
                <Select
                  value={selectedRole}
                  onValueChange={setSelectedRole}
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button
                onClick={handleAddAssignment}
                disabled={disabled || !selectedTenantId}
                size="sm"
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </Card>
        )}

        {/* Empty state */}
        {value.length === 0 && (
          <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
            <Building2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No tenant assignments</p>
            <p className="text-sm text-muted-foreground">Add at least one tenant assignment</p>
          </div>
        )}

        {/* No available tenants */}
        {availableTenants.length === 0 && (
          <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
            <Building2 className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No tenants available</p>
            <p className="text-sm text-muted-foreground">Contact your administrator to get access to tenants</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TenantSelector;


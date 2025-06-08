import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/auth-context";

interface TenantAssignment {
  tenant_id: string;
  tenant_name?: string;
  role_id?: number;
  role_name?: string;
  is_primary: boolean;
  is_active: boolean;
}

interface MultiTenantSelectorProps {
  selectedTenants: TenantAssignment[];
  onTenantsChange: (tenants: TenantAssignment[]) => void;
  availableRoles?: Array<{ id: number; name: string }>;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

export function MultiTenantSelector({
  selectedTenants,
  onTenantsChange,
  availableRoles = [
    { id: 1, name: "user" },
    { id: 2, name: "admin" },
  ],
  disabled = false,
  placeholder = "Select tenants...",
  className = "",
}: MultiTenantSelectorProps) {
  const [open, setOpen] = useState(false);
  const { tenants, user } = useAuth();

  // Filter tenants based on user's access
  const accessibleTenants = tenants.filter(tenant => {
    // MSP users can assign to any tenant
    if (user?.role === "msp") return true;
    
    // Admin users can only assign to tenants they have access to
    // This would need to be enhanced with actual tenant access checking
    return true; // For now, allow all tenants
  });

  const handleTenantSelect = (tenantId: string) => {
    const tenant = accessibleTenants.find(t => t.tenant_id === tenantId);
    if (!tenant) return;

    const isAlreadySelected = selectedTenants.some(t => t.tenant_id === tenantId);
    
    if (isAlreadySelected) {
      // Remove tenant
      onTenantsChange(selectedTenants.filter(t => t.tenant_id !== tenantId));
    } else {
      // Add tenant with default role
      const defaultRole = availableRoles.find(r => r.name === "user") || availableRoles[0];
      const newAssignment: TenantAssignment = {
        tenant_id: tenantId,
        tenant_name: tenant.name,
        role_id: defaultRole.id,
        role_name: defaultRole.name,
        is_primary: selectedTenants.length === 0, // First tenant is primary
        is_active: true,
      };
      onTenantsChange([...selectedTenants, newAssignment]);
    }
    setOpen(false);
  };

  const handleRemoveTenant = (tenantId: string) => {
    const updatedTenants = selectedTenants.filter(t => t.tenant_id !== tenantId);
    
    // If we removed the primary tenant, make the first remaining tenant primary
    if (updatedTenants.length > 0 && !updatedTenants.some(t => t.is_primary)) {
      updatedTenants[0].is_primary = true;
    }
    
    onTenantsChange(updatedTenants);
  };

  const handleRoleChange = (tenantId: string, roleId: number) => {
    const role = availableRoles.find(r => r.id === roleId);
    if (!role) return;

    const updatedTenants = selectedTenants.map(t => 
      t.tenant_id === tenantId 
        ? { ...t, role_id: roleId, role_name: role.name }
        : t
    );
    onTenantsChange(updatedTenants);
  };

  const handleSetPrimary = (tenantId: string) => {
    const updatedTenants = selectedTenants.map(t => ({
      ...t,
      is_primary: t.tenant_id === tenantId
    }));
    onTenantsChange(updatedTenants);
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Tenant Selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Tenant Assignments</label>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
              disabled={disabled}
            >
              <span className="truncate">
                {selectedTenants.length === 0 
                  ? placeholder 
                  : `${selectedTenants.length} tenant${selectedTenants.length === 1 ? '' : 's'} selected`
                }
              </span>
              <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0">
            <Command>
              <CommandInput placeholder="Search tenants..." />
              <CommandList>
                <CommandEmpty>No tenants found.</CommandEmpty>
                <CommandGroup>
                  {accessibleTenants.map((tenant) => {
                    const isSelected = selectedTenants.some(t => t.tenant_id === tenant.tenant_id);
                    return (
                      <CommandItem
                        key={tenant.tenant_id}
                        value={tenant.name}
                        onSelect={() => handleTenantSelect(tenant.tenant_id)}
                        className="text-sm"
                      >
                        {tenant.name}
                        <Check
                          className={`ml-auto h-4 w-4 ${
                            isSelected ? "opacity-100" : "opacity-0"
                          }`}
                        />
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Selected Tenants List */}
      {selectedTenants.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Selected Tenants</label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {selectedTenants.map((assignment) => (
              <div
                key={assignment.tenant_id}
                className="flex items-center justify-between p-3 border rounded-lg bg-muted/50"
              >
                <div className="flex items-center space-x-2">
                  <span className="font-medium">{assignment.tenant_name}</span>
                  {assignment.is_primary && (
                    <Badge variant="default" className="text-xs">Primary</Badge>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  {/* Role Selector */}
                  <select
                    value={assignment.role_id}
                    onChange={(e) => handleRoleChange(assignment.tenant_id, parseInt(e.target.value))}
                    className="text-xs border rounded px-2 py-1 bg-background"
                    disabled={disabled}
                  >
                    {availableRoles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                  
                  {/* Primary Button */}
                  {!assignment.is_primary && selectedTenants.length > 1 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetPrimary(assignment.tenant_id)}
                      className="text-xs h-6 px-2"
                      disabled={disabled}
                    >
                      Set Primary
                    </Button>
                  )}
                  
                  {/* Remove Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveTenant(assignment.tenant_id)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    disabled={disabled}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {selectedTenants.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No tenants selected. Users must be assigned to at least one tenant.
        </p>
      )}
    </div>
  );
}


export type UserRole = "user" | "admin" | "msp";

export interface Tenant {
  id: string;
  tenant_id: string;  // Added tenant_id field
  name: string;
  description?: string;
  date_created?: string;
  date_modified?: string;
}

export interface CloudAccount {
  id: string;
  name: string;
  provider: "azure" | "aws" | "gcp";
  status: "connected" | "warning" | "error" | "pending";
  tenantId: string;
}

export interface Permission {
  name: string;
  description?: string;
}

export interface TenantAssignment {
  tenant_id: string;
  role: string;
  is_primary: boolean;
}

export interface User {
  id: string;
  name: string;  // Changed from full_name to name to match backend
  full_name?: string;  // Keep for backward compatibility
  email: string;
  role: UserRole;
  tenantId: string;
  tenantAssignments?: TenantAssignment[];  // Multi-tenant assignments
  avatar?: string;
  permissions?: (Permission | string)[];  // Allow both Permission objects and strings
  accessibleTenants?: string[];  // List of tenant IDs user can access
  isMspUser?: boolean;  // Flag to identify MSP users
}

// Badge variants for consistency
export type BadgeVariant = "default" | "destructive" | "outline" | "secondary";

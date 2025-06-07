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

export interface User {
  id: string;
  name: string;  // Changed from full_name to name to match backend
  email: string;
  role: UserRole;
  tenantId: string;
  avatar?: string;
  permissions?: (Permission | string)[];  // Allow both Permission objects and strings
  accessibleTenants?: string[];  // List of tenant IDs user can access
  isMspUser?: boolean;  // Flag to identify MSP users
  api_enabled?: boolean;  // New field for API access control
}

// Badge variants for consistency
export type BadgeVariant = "default" | "destructive" | "outline" | "secondary";

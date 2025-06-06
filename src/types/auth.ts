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
  full_name: string;
  email: string;
  role: UserRole;
  tenantId: string;
  avatar?: string;
  permissions?: (Permission | string)[];  // Allow both Permission objects and strings
}

// Badge variants for consistency
export type BadgeVariant = "default" | "destructive" | "outline" | "secondary";

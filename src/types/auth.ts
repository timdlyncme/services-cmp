export type UserRole = "user" | "admin" | "msp";

export interface Tenant {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
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
  name: string;
  email: string;
  role: UserRole;
  tenantId: string;
  avatar?: string;
  permissions?: Permission[];
}

// Badge variants for consistency
export type BadgeVariant = "default" | "destructive" | "outline" | "secondary";

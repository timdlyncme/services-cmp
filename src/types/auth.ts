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
  tenant_name?: string;
  role_id?: number;
  role_name?: string;
  is_primary: boolean;
  is_active: boolean;
  provisioned_via?: string;
  external_group_id?: string;
  external_role_mapping?: string;
}

export interface User {
  id: string;
  full_name: string;  // Keep full_name for consistency with backend
  email: string;
  role: UserRole;
  tenantId: string;  // Primary tenant ID for backward compatibility
  avatar?: string;
  permissions?: (Permission | string)[];  // Allow both Permission objects and strings
  accessibleTenants?: string[];  // List of tenant IDs user can access
  isMspUser?: boolean;  // Flag to identify MSP users
  
  // Multi-tenant support
  primary_tenant_id?: string;
  tenant_assignments?: TenantAssignment[];
  
  // SSO support
  external_id?: string;
  identity_provider?: string;
  is_sso_user?: boolean;
  is_active?: boolean;
}

// Badge variants for consistency
export type BadgeVariant = "default" | "destructive" | "outline" | "secondary";

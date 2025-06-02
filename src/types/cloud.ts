export type CloudProvider = "azure" | "aws" | "gcp";
export type TemplateType = "terraform" | "arm" | "cloudformation";
export type DeploymentStatus = "running" | "pending" | "failed" | "stopped" | "deploying";
export type IntegrationStatus = "connected" | "warning" | "error" | "pending";

export interface CloudAccount {
  id: string;
  name: string;
  provider: CloudProvider;
  status: IntegrationStatus;
  tenantId: string;
  connectionDetails?: Record<string, string>;
}

export interface CloudTemplate {
  id: string;
  template_id?: string; // Added for GUID template ID
  name: string;
  description: string;
  type: TemplateType;
  provider: CloudProvider;
  code: string;
  deploymentCount: number;
  uploadedAt: string;
  updatedAt: string;
  categories: string[];
  tenantId: string;
  lastUpdatedBy?: string;
  parameters?: Record<string, TemplateParameter>;
  variables?: Record<string, TemplateVariable>;
  version?: string; // Add version field
}

export interface TemplateParameter {
  value: string;
  type: "string" | "int" | "password";
  description: string;
  required: boolean;
}

export interface TemplateVariable {
  value: string;
  description: string;
  sensitive: boolean;
}

export interface CloudDeployment {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  templateVersion?: string; // Add template version field
  provider: CloudProvider;
  status: DeploymentStatus;
  environment: string;
  createdAt: string;
  updatedAt: string;
  parameters: Record<string, string>;
  resources: CloudResource[];
  tenantId: string;
  logs?: DeploymentLog[];
  details?: DeploymentDetails; // Add details field
}

export interface DeploymentDetails {
  outputs?: Record<string, any>;
  resources?: CloudResource[];
  logs?: any[];
  error_details?: any;
}

export interface CloudResource {
  id: string;
  name: string;
  type: string;
  location: string;
  status: string;
  properties: {
    vmSize?: string;
    osType?: string;
    adminUsername?: string;
    networkProfile?: {
      networkInterfaces: Array<{
        id: string;
      }>;
    };
    storageProfile?: {
      osDisk: {
        name: string;
        createOption: string;
        diskSizeGB: number;
      };
      dataDisks: Array<{
        name: string;
        diskSizeGB: number;
        lun: number;
      }>;
    };
    [key: string]: any;
  };
  tags: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface DeploymentLog {
  id: number;
  status: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  user_id?: number;
}

export interface IntegrationConfig {
  id: string;
  name: string;
  type: "cloud" | "ai" | "other";
  provider: CloudProvider | "openai" | "other";
  status: IntegrationStatus;
  lastChecked: string;
  tenantId: string;
  settings: Record<string, string>;
}

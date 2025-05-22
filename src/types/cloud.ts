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
}

export interface TemplateParameter {
  value: string;
  type: "string" | "int" | "password";
  description?: string;
}

export interface TemplateVariable {
  value: string;
  type: "string" | "int" | "password";
  description?: string;
}

export interface CloudDeployment {
  id: string;
  name: string;
  templateId: string;
  templateName: string;
  provider: CloudProvider;
  status: DeploymentStatus;
  environment: string;
  createdAt: string;
  updatedAt: string;
  parameters: Record<string, string>;
  resources: string[];
  tenantId: string;
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

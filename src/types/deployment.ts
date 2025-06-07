/**
 * Types for deployment token management and deployment workflows
 */

export interface DeploymentToken {
  token: string;
  expires_in_minutes: number;
}

export interface DeploymentTokenValidation {
  valid: boolean;
  user_id?: string;
  token_age_seconds?: number;
  error?: string;
}

export interface DeploymentContext {
  token: string;
  expiresAt: Date;
  userId: string;
}

export interface DeploymentWizardStep {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  current: boolean;
}

export interface DeploymentFormData {
  templateId: string;
  templateName: string;
  deploymentName: string;
  environment: string;
  cloudAccountId: string;
  subscriptionId?: string;
  parameters: Record<string, any>;
  variables: Record<string, any>;
}

export interface Environment {
  id: string;
  name: string;
  description?: string;
  type: 'development' | 'staging' | 'production';
  tenantId: string;
}

export interface DeploymentError {
  code: string;
  message: string;
  details?: any;
}


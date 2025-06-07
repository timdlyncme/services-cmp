// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// API endpoints
export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',
  REFRESH: '/auth/refresh',
  
  // Users
  USERS: '/users',
  CURRENT_USER: '/users/me',
  
  // Tenants
  TENANTS: '/tenants',
  
  // Deployments
  DEPLOYMENTS: '/deployments',
  DEPLOYMENT_TOKEN: '/deployment/token',
  DEPLOYMENT_TOKEN_VALIDATE: '/deployment/validate-token',
  
  // Cloud Accounts
  CLOUD_ACCOUNTS: '/cloud-accounts',
  
  // Templates
  TEMPLATES: '/templates',
  
  // Environments
  ENVIRONMENTS: '/environments',
  
  // Dashboards
  DASHBOARDS: '/dashboards',
  DASHBOARD_WIDGETS: '/dashboards/widgets/templates',
  WIDGET_DATA: '/widgets/data',
  
  // Permissions
  PERMISSIONS: '/permissions',
  
  // Integrations
  INTEGRATIONS: '/integrations',
  
  // Template Foundry
  TEMPLATE_FOUNDRY: '/template-foundry',
  
  // Health
  HEALTH: '/health',
  
  // AI Assistant
  AI_ASSISTANT: '/ai-assistant',
  
  // Nexus AI
  NEXUS_AI: '/nexus-ai',
} as const;

// Request timeout in milliseconds
export const REQUEST_TIMEOUT = 30000;

// Default headers
export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
} as const;

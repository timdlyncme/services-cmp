import { API_BASE_URL } from './api-config';

export interface SSOLoginRequest {
  provider_type: string;
  domain?: string;
  redirect_uri?: string;
}

export interface SSOLoginResponse {
  authorization_url: string;
  state: string;
}

export interface SSOCallbackRequest {
  code: string;
  state: string;
  provider_type: string;
}

export interface SSOCallbackResponse {
  user: any;
  token: string;
  token_type: string;
  is_new_user: boolean;
}

export interface SSOProvider {
  id: number;
  provider_id: string;
  name: string;
  provider_type: string;
  is_active: boolean;
  client_id: string;
  tenant_id?: string;
  authority?: string;
  discovery_url?: string;
  scim_enabled: boolean;
  scim_base_url?: string;
  attribute_mappings?: Record<string, string>;
  default_role_id?: number;
  tenant_id_fk: string;
  created_at: string;
  updated_at: string;
}

class SSOService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/sso`;
  }

  /**
   * Get available SSO providers for the current tenant
   */
  async getProviders(): Promise<SSOProvider[]> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${this.baseUrl}/providers`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get SSO providers: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create a new SSO provider
   */
  async createProvider(provider: Partial<SSOProvider>): Promise<SSOProvider> {
    const token = localStorage.getItem('token');
    const response = await fetch(`${this.baseUrl}/providers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(provider),
    });

    if (!response.ok) {
      throw new Error(`Failed to create SSO provider: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Initiate SSO login flow
   */
  async initiateLogin(request: SSOLoginRequest): Promise<SSOLoginResponse> {
    const response = await fetch(`${this.baseUrl}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to initiate SSO login: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Handle SSO callback after authentication
   */
  async handleCallback(request: SSOCallbackRequest): Promise<SSOCallbackResponse> {
    const response = await fetch(`${this.baseUrl}/callback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`Failed to handle SSO callback: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get SSO login URL for Azure AD
   */
  async getAzureADLoginUrl(domain?: string): Promise<string> {
    const currentUrl = window.location.origin;
    const redirectUri = `${currentUrl}/sso/callback`;
    
    const response = await this.initiateLogin({
      provider_type: 'azure_ad',
      domain,
      redirect_uri: redirectUri,
    });

    // Store state for validation
    sessionStorage.setItem('sso_state', response.state);
    sessionStorage.setItem('sso_provider', 'azure_ad');

    return response.authorization_url;
  }

  /**
   * Handle SSO callback from URL parameters
   */
  async handleCallbackFromUrl(): Promise<SSOCallbackResponse> {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');

    if (error) {
      throw new Error(`SSO authentication failed: ${error} - ${errorDescription}`);
    }

    if (!code || !state) {
      throw new Error('Missing authorization code or state parameter');
    }

    // Validate state
    const storedState = sessionStorage.getItem('sso_state');
    const storedProvider = sessionStorage.getItem('sso_provider');

    if (state !== storedState) {
      throw new Error('Invalid state parameter - possible CSRF attack');
    }

    if (!storedProvider) {
      throw new Error('Missing SSO provider information');
    }

    // Clean up session storage
    sessionStorage.removeItem('sso_state');
    sessionStorage.removeItem('sso_provider');

    // Handle callback
    return this.handleCallback({
      code,
      state,
      provider_type: storedProvider,
    });
  }

  /**
   * Check if current URL is an SSO callback
   */
  isCallbackUrl(): boolean {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has('code') && urlParams.has('state');
  }

  /**
   * Detect domain from email address
   */
  getDomainFromEmail(email: string): string {
    const parts = email.split('@');
    return parts.length > 1 ? parts[1] : '';
  }

  /**
   * Check if domain supports SSO
   */
  async checkDomainSSO(domain: string): Promise<boolean> {
    try {
      // This is a simplified check - in production you might want to
      // check against a list of configured domains or make an API call
      const commonSSODomains = [
        'microsoft.com',
        'outlook.com',
        'hotmail.com',
        // Add more domains as needed
      ];

      return commonSSODomains.some(d => domain.toLowerCase().includes(d.toLowerCase()));
    } catch (error) {
      console.error('Error checking domain SSO support:', error);
      return false;
    }
  }
}

export const ssoService = new SSOService();


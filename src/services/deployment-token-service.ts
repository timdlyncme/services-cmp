/**
 * Service for managing deployment context tokens
 */

import axios from 'axios';
import { API_BASE_URL, API_ENDPOINTS } from '@/config/api';
import { DeploymentToken, DeploymentTokenValidation, DeploymentContext } from '@/types/deployment';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: false
});

export class DeploymentTokenService {
  private static instance: DeploymentTokenService;
  private currentContext: DeploymentContext | null = null;

  private constructor() {}

  static getInstance(): DeploymentTokenService {
    if (!DeploymentTokenService.instance) {
      DeploymentTokenService.instance = new DeploymentTokenService();
    }
    return DeploymentTokenService.instance;
  }

  /**
   * Generate a new deployment token
   */
  async generateToken(): Promise<DeploymentToken> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await api.post(API_ENDPOINTS.DEPLOYMENT_TOKEN, {}, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const deploymentToken: DeploymentToken = response.data;
      
      // Store the context for automatic header injection
      this.currentContext = {
        token: deploymentToken.token,
        expiresAt: new Date(Date.now() + deploymentToken.expires_in_minutes * 60 * 1000),
        userId: this.extractUserIdFromToken(deploymentToken.token) || ''
      };

      console.log('Generated deployment token, expires in', deploymentToken.expires_in_minutes, 'minutes');
      return deploymentToken;
    } catch (error) {
      console.error('Failed to generate deployment token:', error);
      throw error;
    }
  }

  /**
   * Validate a deployment token
   */
  async validateToken(token: string): Promise<DeploymentTokenValidation> {
    try {
      const authToken = localStorage.getItem('token');
      if (!authToken) {
        throw new Error('Authentication token not found');
      }

      const response = await api.post(API_ENDPOINTS.DEPLOYMENT_TOKEN_VALIDATE, 
        { token },
        {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('Failed to validate deployment token:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get current deployment context
   */
  getCurrentContext(): DeploymentContext | null {
    // Check if context exists and is not expired
    if (this.currentContext && this.currentContext.expiresAt > new Date()) {
      return this.currentContext;
    }
    
    // Clear expired context
    if (this.currentContext) {
      this.clearContext();
    }
    
    return null;
  }

  /**
   * Clear current deployment context
   */
  clearContext(): void {
    this.currentContext = null;
    console.log('Cleared deployment context');
  }

  /**
   * Check if we have a valid deployment context
   */
  hasValidContext(): boolean {
    return this.getCurrentContext() !== null;
  }

  /**
   * Get deployment context header for API requests
   */
  getDeploymentHeader(): Record<string, string> {
    const context = this.getCurrentContext();
    if (context) {
      return {
        'X-Deployment-Context': context.token
      };
    }
    return {};
  }

  /**
   * Refresh deployment token if needed
   */
  async ensureValidToken(): Promise<boolean> {
    const context = this.getCurrentContext();
    
    // If no context or expires in less than 5 minutes, generate new token
    if (!context || (context.expiresAt.getTime() - Date.now()) < 5 * 60 * 1000) {
      try {
        await this.generateToken();
        return true;
      } catch (error) {
        console.error('Failed to refresh deployment token:', error);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Extract user ID from token (for debugging/validation)
   */
  private extractUserIdFromToken(token: string): string | null {
    try {
      const parts = token.split(':');
      return parts.length >= 1 ? parts[0] : null;
    } catch {
      return null;
    }
  }

  /**
   * Get time remaining for current token
   */
  getTimeRemaining(): number {
    const context = this.getCurrentContext();
    if (!context) return 0;
    
    return Math.max(0, context.expiresAt.getTime() - Date.now());
  }

  /**
   * Get time remaining in minutes
   */
  getTimeRemainingMinutes(): number {
    return Math.floor(this.getTimeRemaining() / (60 * 1000));
  }
}

// Export singleton instance
export const deploymentTokenService = DeploymentTokenService.getInstance();


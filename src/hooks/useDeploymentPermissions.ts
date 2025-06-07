/**
 * Hook for checking deployment permissions and managing deployment context
 */

import { useState, useEffect } from 'react';
import { User } from '@/types/auth';
import { deploymentTokenService } from '@/services/deployment-token-service';

interface DeploymentPermissions {
  canDeploy: boolean;
  canViewTemplates: boolean;
  hasApiAccess: boolean;
  hasDeploymentContext: boolean;
  isLoading: boolean;
  error: string | null;
}

export const useDeploymentPermissions = (user: User | null): DeploymentPermissions => {
  const [permissions, setPermissions] = useState<DeploymentPermissions>({
    canDeploy: false,
    canViewTemplates: false,
    hasApiAccess: false,
    hasDeploymentContext: false,
    isLoading: true,
    error: null
  });

  useEffect(() => {
    const checkPermissions = () => {
      if (!user) {
        setPermissions({
          canDeploy: false,
          canViewTemplates: false,
          hasApiAccess: false,
          hasDeploymentContext: false,
          isLoading: false,
          error: null
        });
        return;
      }

      try {
        // Check if user has deployment permission
        const canDeploy = user.permissions?.some(
          p => typeof p === 'string' ? p === 'deploy:templates' : p.name === 'deploy:templates'
        ) || false;

        // Check if user has template viewing permission
        const canViewTemplates = user.permissions?.some(
          p => typeof p === 'string' ? p === 'view:templates' : p.name === 'view:templates'
        ) || false;

        // Check if user has API access enabled
        const hasApiAccess = user.api_enabled || false;

        // Check if user has valid deployment context
        const hasDeploymentContext = deploymentTokenService.hasValidContext();

        setPermissions({
          canDeploy,
          canViewTemplates,
          hasApiAccess,
          hasDeploymentContext,
          isLoading: false,
          error: null
        });
      } catch (error) {
        console.error('Error checking deployment permissions:', error);
        setPermissions({
          canDeploy: false,
          canViewTemplates: false,
          hasApiAccess: false,
          hasDeploymentContext: false,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    };

    checkPermissions();

    // Re-check permissions every 30 seconds to update deployment context status
    const interval = setInterval(checkPermissions, 30000);

    return () => clearInterval(interval);
  }, [user]);

  return permissions;
};

/**
 * Hook for managing deployment workflow state
 */
export const useDeploymentWorkflow = () => {
  const [isDeploymentActive, setIsDeploymentActive] = useState(false);
  const [deploymentError, setDeploymentError] = useState<string | null>(null);

  const startDeployment = async (): Promise<boolean> => {
    try {
      setDeploymentError(null);
      setIsDeploymentActive(true);
      
      // Generate deployment token
      await deploymentTokenService.generateToken();
      return true;
    } catch (error) {
      console.error('Failed to start deployment:', error);
      setDeploymentError(error instanceof Error ? error.message : 'Failed to start deployment');
      setIsDeploymentActive(false);
      return false;
    }
  };

  const endDeployment = () => {
    deploymentTokenService.clearContext();
    setIsDeploymentActive(false);
    setDeploymentError(null);
  };

  const refreshToken = async (): Promise<boolean> => {
    try {
      await deploymentTokenService.ensureValidToken();
      return true;
    } catch (error) {
      console.error('Failed to refresh deployment token:', error);
      setDeploymentError(error instanceof Error ? error.message : 'Failed to refresh token');
      return false;
    }
  };

  return {
    isDeploymentActive,
    deploymentError,
    startDeployment,
    endDeployment,
    refreshToken
  };
};


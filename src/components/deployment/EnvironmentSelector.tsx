/**
 * Environment Selector Component
 * 
 * Allows users to select deployment environments with secure token access
 */

import React, { useState, useEffect } from 'react';
import { Environment } from '@/types/deployment';
import { deploymentService } from '@/services/deployment-service';

interface EnvironmentSelectorProps {
  tenantId: string;
  selectedEnvironment: string;
  onEnvironmentChange: (environment: string) => void;
}

export const EnvironmentSelector: React.FC<EnvironmentSelectorProps> = ({
  tenantId,
  selectedEnvironment,
  onEnvironmentChange
}) => {
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadEnvironments = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Use deployment-specific method that ensures token
        const envs = await deploymentService.getEnvironmentsForDeployment(tenantId);
        setEnvironments(envs);
      } catch (error) {
        console.error('Failed to load environments:', error);
        setError('Failed to load environments. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadEnvironments();
  }, [tenantId]);

  const getEnvironmentIcon = (type: string) => {
    switch (type) {
      case 'production':
        return (
          <div className=\"w-3 h-3 bg-red-500 rounded-full\"></div>
        );
      case 'staging':
        return (
          <div className=\"w-3 h-3 bg-yellow-500 rounded-full\"></div>
        );
      case 'development':
        return (
          <div className=\"w-3 h-3 bg-green-500 rounded-full\"></div>
        );
      default:
        return (
          <div className=\"w-3 h-3 bg-gray-500 rounded-full\"></div>
        );
    }
  };

  const getEnvironmentDescription = (type: string) => {
    switch (type) {
      case 'production':
        return 'Live production environment';
      case 'staging':
        return 'Pre-production testing environment';
      case 'development':
        return 'Development and testing environment';
      default:
        return 'Custom environment';
    }
  };

  if (isLoading) {
    return (
      <div className=\"space-y-4\">
        <h3 className=\"text-lg font-medium text-gray-900\">Select Environment</h3>
        <div className=\"flex items-center justify-center p-8\">
          <div className=\"animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600\"></div>
          <span className=\"ml-2 text-gray-600\">Loading environments...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className=\"space-y-4\">
        <h3 className=\"text-lg font-medium text-gray-900\">Select Environment</h3>
        <div className=\"bg-red-50 border border-red-200 rounded-lg p-4\">
          <div className=\"flex\">
            <div className=\"flex-shrink-0\">
              <svg className=\"h-5 w-5 text-red-400\" viewBox=\"0 0 20 20\" fill=\"currentColor\">
                <path fillRule=\"evenodd\" d=\"M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z\" clipRule=\"evenodd\" />
              </svg>
            </div>
            <div className=\"ml-3\">
              <p className=\"text-sm text-red-700\">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (environments.length === 0) {
    return (
      <div className=\"space-y-4\">
        <h3 className=\"text-lg font-medium text-gray-900\">Select Environment</h3>
        <div className=\"text-center p-8 bg-gray-50 rounded-lg\">
          <svg className=\"mx-auto h-12 w-12 text-gray-400\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\">
            <path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10\" />
          </svg>
          <h3 className=\"mt-2 text-sm font-medium text-gray-900\">No environments available</h3>
          <p className=\"mt-1 text-sm text-gray-500\">
            No environments are configured for this tenant.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className=\"space-y-4\">
      <div>
        <h3 className=\"text-lg font-medium text-gray-900\">Select Environment</h3>
        <p className=\"text-sm text-gray-600 mt-1\">
          Choose the target environment for your deployment
        </p>
      </div>

      <div className=\"space-y-3\">
        {environments.map((environment) => (
          <div
            key={environment.id}
            className={`relative rounded-lg border p-4 cursor-pointer transition-colors ${
              selectedEnvironment === environment.name
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
            onClick={() => onEnvironmentChange(environment.name)}
          >
            <div className=\"flex items-start\">
              <div className=\"flex h-5 items-center\">
                <input
                  type=\"radio\"
                  name=\"environment\"
                  value={environment.name}
                  checked={selectedEnvironment === environment.name}
                  onChange={() => onEnvironmentChange(environment.name)}
                  className=\"h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500\"
                />
              </div>
              <div className=\"ml-3 flex-1\">
                <div className=\"flex items-center space-x-2\">
                  {getEnvironmentIcon(environment.type)}
                  <label className=\"text-sm font-medium text-gray-900 cursor-pointer\">
                    {environment.name}
                  </label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    environment.type === 'production' 
                      ? 'bg-red-100 text-red-800'
                      : environment.type === 'staging'
                        ? 'bg-yellow-100 text-yellow-800'
                        : environment.type === 'development'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                  }`}>
                    {environment.type}
                  </span>
                </div>
                {environment.description && (
                  <p className=\"text-sm text-gray-600 mt-1\">
                    {environment.description}
                  </p>
                )}
                <p className=\"text-xs text-gray-500 mt-1\">
                  {getEnvironmentDescription(environment.type)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedEnvironment && (
        <div className=\"mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg\">
          <div className=\"flex items-center\">
            <svg className=\"h-5 w-5 text-blue-400\" viewBox=\"0 0 20 20\" fill=\"currentColor\">
              <path fillRule=\"evenodd\" d=\"M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z\" clipRule=\"evenodd\" />
            </svg>
            <span className=\"ml-2 text-sm text-blue-700\">
              Environment selected: <strong>{selectedEnvironment}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
};


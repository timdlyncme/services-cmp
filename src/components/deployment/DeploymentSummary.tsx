/**
 * Deployment Summary Component
 * 
 * Shows a summary of the deployment configuration before final deployment
 */

import React from 'react';
import { CloudTemplate } from '@/types/cloud';
import { DeploymentFormData } from '@/types/deployment';

interface DeploymentSummaryProps {
  formData: DeploymentFormData;
  template: CloudTemplate;
}

export const DeploymentSummary: React.FC<DeploymentSummaryProps> = ({
  formData,
  template
}) => {
  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'azure':
        return (
          <div className=\"w-6 h-6 bg-blue-600 rounded flex items-center justify-center\">
            <span className=\"text-white text-xs font-bold\">Az</span>
          </div>
        );
      case 'aws':
        return (
          <div className=\"w-6 h-6 bg-orange-500 rounded flex items-center justify-center\">
            <span className=\"text-white text-xs font-bold\">AWS</span>
          </div>
        );
      case 'gcp':
        return (
          <div className=\"w-6 h-6 bg-red-500 rounded flex items-center justify-center\">
            <span className=\"text-white text-xs font-bold\">GCP</span>
          </div>
        );
      default:
        return (
          <div className=\"w-6 h-6 bg-gray-500 rounded flex items-center justify-center\">
            <span className=\"text-white text-xs font-bold\">?</span>
          </div>
        );
    }
  };

  const getTemplateTypeIcon = (type: string) => {
    switch (type) {
      case 'terraform':
        return (
          <div className=\"w-6 h-6 bg-purple-600 rounded flex items-center justify-center\">
            <span className=\"text-white text-xs font-bold\">TF</span>
          </div>
        );
      case 'arm':
        return (
          <div className=\"w-6 h-6 bg-blue-600 rounded flex items-center justify-center\">
            <span className=\"text-white text-xs font-bold\">ARM</span>
          </div>
        );
      case 'cloudformation':
        return (
          <div className=\"w-6 h-6 bg-orange-600 rounded flex items-center justify-center\">
            <span className=\"text-white text-xs font-bold\">CF</span>
          </div>
        );
      default:
        return (
          <div className=\"w-6 h-6 bg-gray-600 rounded flex items-center justify-center\">
            <span className=\"text-white text-xs font-bold\">?</span>
          </div>
        );
    }
  };

  const hasParameters = Object.keys(formData.parameters).length > 0;
  const hasVariables = Object.keys(formData.variables).length > 0;

  return (
    <div className=\"space-y-6\">
      <div>
        <h3 className=\"text-lg font-medium text-gray-900\">Review & Deploy</h3>
        <p className=\"text-sm text-gray-600 mt-1\">
          Review your deployment configuration and click Deploy to start the deployment
        </p>
      </div>

      {/* Deployment Overview */}
      <div className=\"bg-gray-50 rounded-lg p-6\">
        <h4 className=\"text-md font-medium text-gray-900 mb-4\">Deployment Overview</h4>
        
        <div className=\"grid grid-cols-1 md:grid-cols-2 gap-6\">
          {/* Template Information */}
          <div>
            <h5 className=\"text-sm font-medium text-gray-700 mb-3\">Template</h5>
            <div className=\"bg-white rounded-lg border p-4\">
              <div className=\"flex items-center space-x-3\">
                {getTemplateTypeIcon(template.type)}
                {getProviderIcon(template.provider)}
                <div>
                  <p className=\"text-sm font-medium text-gray-900\">{template.name}</p>
                  <p className=\"text-xs text-gray-500\">{template.type} • {template.provider}</p>
                </div>
              </div>
              {template.description && (
                <p className=\"text-sm text-gray-600 mt-3\">{template.description}</p>
              )}
            </div>
          </div>

          {/* Deployment Configuration */}
          <div>
            <h5 className=\"text-sm font-medium text-gray-700 mb-3\">Configuration</h5>
            <div className=\"bg-white rounded-lg border p-4 space-y-3\">
              <div>
                <span className=\"text-xs font-medium text-gray-500\">Deployment Name</span>
                <p className=\"text-sm text-gray-900\">{formData.deploymentName}</p>
              </div>
              <div>
                <span className=\"text-xs font-medium text-gray-500\">Environment</span>
                <p className=\"text-sm text-gray-900\">{formData.environment}</p>
              </div>
              <div>
                <span className=\"text-xs font-medium text-gray-500\">Cloud Account</span>
                <p className=\"text-sm text-gray-900\">{formData.cloudAccountId}</p>
              </div>
              {formData.subscriptionId && (
                <div>
                  <span className=\"text-xs font-medium text-gray-500\">Subscription</span>
                  <p className=\"text-sm text-gray-900\">{formData.subscriptionId}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Parameters */}
      {hasParameters && (
        <div>
          <h4 className=\"text-md font-medium text-gray-900 mb-3\">Parameters</h4>
          <div className=\"bg-white rounded-lg border\">
            <div className=\"px-4 py-3 border-b border-gray-200\">
              <h5 className=\"text-sm font-medium text-gray-700\">Template Parameters</h5>
            </div>
            <div className=\"p-4\">
              <div className=\"space-y-3\">
                {Object.entries(formData.parameters).map(([key, value]) => (
                  <div key={key} className=\"flex justify-between items-start\">
                    <span className=\"text-sm font-medium text-gray-700\">{key}</span>
                    <span className=\"text-sm text-gray-900 text-right max-w-xs truncate\">
                      {typeof value === 'string' && value.length > 50 
                        ? `${value.substring(0, 50)}...` 
                        : String(value)
                      }
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Variables */}
      {hasVariables && (
        <div>
          <h4 className=\"text-md font-medium text-gray-900 mb-3\">Variables</h4>
          <div className=\"bg-white rounded-lg border\">
            <div className=\"px-4 py-3 border-b border-gray-200\">
              <h5 className=\"text-sm font-medium text-gray-700\">Template Variables</h5>
            </div>
            <div className=\"p-4\">
              <div className=\"space-y-3\">
                {Object.entries(formData.variables).map(([key, value]) => {
                  const templateVar = template.variables?.[key];
                  const isSensitive = templateVar?.sensitive;
                  
                  return (
                    <div key={key} className=\"flex justify-between items-start\">
                      <div className=\"flex items-center space-x-2\">
                        <span className=\"text-sm font-medium text-gray-700\">{key}</span>
                        {isSensitive && (
                          <span className=\"inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800\">
                            Sensitive
                          </span>
                        )}
                      </div>
                      <span className=\"text-sm text-gray-900 text-right max-w-xs truncate\">
                        {isSensitive 
                          ? '••••••••' 
                          : typeof value === 'string' && value.length > 50 
                            ? `${value.substring(0, 50)}...` 
                            : String(value)
                        }
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warning */}
      <div className=\"bg-yellow-50 border border-yellow-200 rounded-lg p-4\">
        <div className=\"flex\">
          <div className=\"flex-shrink-0\">
            <svg className=\"h-5 w-5 text-yellow-400\" viewBox=\"0 0 20 20\" fill=\"currentColor\">
              <path fillRule=\"evenodd\" d=\"M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z\" clipRule=\"evenodd\" />
            </svg>
          </div>
          <div className=\"ml-3\">
            <h3 className=\"text-sm font-medium text-yellow-800\">
              Ready to Deploy
            </h3>
            <div className=\"mt-2 text-sm text-yellow-700\">
              <p>
                Please review all configuration details above. Once you click Deploy, 
                the deployment process will begin and cannot be easily reversed.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Deployment Actions */}
      <div className=\"bg-blue-50 border border-blue-200 rounded-lg p-4\">
        <div className=\"flex\">
          <div className=\"flex-shrink-0\">
            <svg className=\"h-5 w-5 text-blue-400\" viewBox=\"0 0 20 20\" fill=\"currentColor\">
              <path fillRule=\"evenodd\" d=\"M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z\" clipRule=\"evenodd\" />
            </svg>
          </div>
          <div className=\"ml-3\">
            <h3 className=\"text-sm font-medium text-blue-800\">
              What happens next?
            </h3>
            <div className=\"mt-2 text-sm text-blue-700\">
              <ul className=\"list-disc list-inside space-y-1\">
                <li>Your deployment will be queued and processed</li>
                <li>You'll receive real-time updates on the deployment progress</li>
                <li>Resources will be created in your selected cloud account</li>
                <li>You can monitor the deployment from the deployments dashboard</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


/**
 * Deployment Wizard Component
 * 
 * Guides users through the template deployment process with secure token management
 */

import React, { useState, useEffect } from 'react';
import { CloudTemplate } from '@/types/cloud';
import { DeploymentFormData, DeploymentWizardStep } from '@/types/deployment';
import { deploymentTokenService } from '@/services/deployment-token-service';
import { deploymentService } from '@/services/deployment-service';
import { EnvironmentSelector } from './EnvironmentSelector';
import { CloudAccountSelector } from './CloudAccountSelector';
import { DeploymentParameters } from './DeploymentParameters';
import { DeploymentSummary } from './DeploymentSummary';
import { TokenStatus } from './TokenStatus';

interface DeploymentWizardProps {
  template: CloudTemplate;
  tenantId: string;
  onComplete: (deployment: any) => void;
  onCancel: () => void;
}

const WIZARD_STEPS: DeploymentWizardStep[] = [
  {
    id: 'environment',
    title: 'Select Environment',
    description: 'Choose the target environment for deployment',
    completed: false,
    current: true
  },
  {
    id: 'cloud-account',
    title: 'Select Cloud Account',
    description: 'Choose the cloud account and subscription',
    completed: false,
    current: false
  },
  {
    id: 'parameters',
    title: 'Configure Parameters',
    description: 'Set template parameters and variables',
    completed: false,
    current: false
  },
  {
    id: 'review',
    title: 'Review & Deploy',
    description: 'Review configuration and deploy',
    completed: false,
    current: false
  }
];

export const DeploymentWizard: React.FC<DeploymentWizardProps> = ({
  template,
  tenantId,
  onComplete,
  onCancel
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState(WIZARD_STEPS);
  const [formData, setFormData] = useState<DeploymentFormData>({
    templateId: template.id,
    templateName: template.name,
    deploymentName: `${template.name}-${Date.now()}`,
    environment: '',
    cloudAccountId: '',
    subscriptionId: '',
    parameters: {},
    variables: {}
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tokenInitialized, setTokenInitialized] = useState(false);

  // Initialize deployment token when wizard opens
  useEffect(() => {
    const initializeToken = async () => {
      try {
        setIsLoading(true);
        await deploymentTokenService.generateToken();
        setTokenInitialized(true);
        console.log('Deployment token initialized for wizard');
      } catch (error) {
        console.error('Failed to initialize deployment token:', error);
        setError('Failed to initialize deployment session. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    initializeToken();

    // Cleanup token when component unmounts
    return () => {
      deploymentTokenService.clearContext();
    };
  }, []);

  const updateSteps = (stepIndex: number, completed: boolean = false) => {
    setSteps(prevSteps => 
      prevSteps.map((step, index) => ({
        ...step,
        completed: index < stepIndex || completed,
        current: index === stepIndex
      }))
    );
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      updateSteps(currentStep, true);
      setCurrentStep(currentStep + 1);
      updateSteps(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      updateSteps(currentStep - 1);
    }
  };

  const handleFormDataChange = (updates: Partial<DeploymentFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleDeploy = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Ensure we have a valid token before deployment
      const hasValidToken = await deploymentTokenService.ensureValidToken();
      if (!hasValidToken) {
        throw new Error('Failed to obtain deployment token');
      }

      // Create deployment
      const deployment = await deploymentService.createDeployment(formData, tenantId);
      
      // Clear token after successful deployment
      deploymentTokenService.clearContext();
      
      onComplete(deployment);
    } catch (error) {
      console.error('Deployment failed:', error);
      setError(error instanceof Error ? error.message : 'Deployment failed');
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: // Environment
        return formData.environment !== '';
      case 1: // Cloud Account
        return formData.cloudAccountId !== '';
      case 2: // Parameters
        return true; // Parameters are optional
      case 3: // Review
        return true;
      default:
        return false;
    }
  };

  const renderStepContent = () => {
    if (!tokenInitialized) {
      return (
        <div className=\"flex items-center justify-center p-8\">
          <div className=\"text-center\">
            <div className=\"animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4\"></div>
            <p className=\"text-gray-600\">Initializing deployment session...</p>
          </div>
        </div>
      );
    }

    switch (currentStep) {
      case 0:
        return (
          <EnvironmentSelector
            tenantId={tenantId}
            selectedEnvironment={formData.environment}
            onEnvironmentChange={(environment) => 
              handleFormDataChange({ environment })
            }
          />
        );
      case 1:
        return (
          <CloudAccountSelector
            tenantId={tenantId}
            selectedCloudAccountId={formData.cloudAccountId}
            selectedSubscriptionId={formData.subscriptionId}
            onCloudAccountChange={(cloudAccountId) => 
              handleFormDataChange({ cloudAccountId })
            }
            onSubscriptionChange={(subscriptionId) => 
              handleFormDataChange({ subscriptionId })
            }
          />
        );
      case 2:
        return (
          <DeploymentParameters
            template={template}
            parameters={formData.parameters}
            variables={formData.variables}
            onParametersChange={(parameters) => 
              handleFormDataChange({ parameters })
            }
            onVariablesChange={(variables) => 
              handleFormDataChange({ variables })
            }
          />
        );
      case 3:
        return (
          <DeploymentSummary
            formData={formData}
            template={template}
          />
        );
      default:
        return null;
    }
  };

  if (error && !tokenInitialized) {
    return (
      <div className=\"bg-red-50 border border-red-200 rounded-lg p-6\">
        <div className=\"flex items-center\">
          <div className=\"flex-shrink-0\">
            <svg className=\"h-5 w-5 text-red-400\" viewBox=\"0 0 20 20\" fill=\"currentColor\">
              <path fillRule=\"evenodd\" d=\"M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z\" clipRule=\"evenodd\" />
            </svg>
          </div>
          <div className=\"ml-3\">
            <h3 className=\"text-sm font-medium text-red-800\">
              Deployment Session Error
            </h3>
            <div className=\"mt-2 text-sm text-red-700\">
              <p>{error}</p>
            </div>
            <div className=\"mt-4\">
              <button
                onClick={onCancel}
                className=\"bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded-md text-sm font-medium\"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className=\"max-w-4xl mx-auto p-6\">
      {/* Header */}
      <div className=\"mb-8\">
        <h1 className=\"text-2xl font-bold text-gray-900 mb-2\">
          Deploy Template: {template.name}
        </h1>
        <p className=\"text-gray-600\">
          Follow the steps below to configure and deploy your template
        </p>
        
        {/* Token Status */}
        <TokenStatus />
      </div>

      {/* Progress Steps */}
      <div className=\"mb-8\">
        <nav aria-label=\"Progress\">
          <ol className=\"flex items-center\">
            {steps.map((step, index) => (
              <li key={step.id} className={`relative ${index !== steps.length - 1 ? 'pr-8 sm:pr-20' : ''}`}>
                <div className=\"flex items-center\">
                  <div className={`relative flex h-8 w-8 items-center justify-center rounded-full ${
                    step.completed 
                      ? 'bg-green-600' 
                      : step.current 
                        ? 'bg-blue-600' 
                        : 'bg-gray-300'
                  }`}>
                    {step.completed ? (
                      <svg className=\"h-5 w-5 text-white\" viewBox=\"0 0 20 20\" fill=\"currentColor\">
                        <path fillRule=\"evenodd\" d=\"M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z\" clipRule=\"evenodd\" />
                      </svg>
                    ) : (
                      <span className={`text-sm font-medium ${step.current ? 'text-white' : 'text-gray-500'}`}>
                        {index + 1}
                      </span>
                    )}
                  </div>
                  <span className=\"ml-4 text-sm font-medium text-gray-900\">
                    {step.title}
                  </span>
                </div>
                {index !== steps.length - 1 && (
                  <div className=\"absolute top-4 left-4 -ml-px mt-0.5 h-full w-0.5 bg-gray-300\" />
                )}
              </li>
            ))}
          </ol>
        </nav>
      </div>

      {/* Error Display */}
      {error && (
        <div className=\"mb-6 bg-red-50 border border-red-200 rounded-lg p-4\">
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
      )}

      {/* Step Content */}
      <div className=\"bg-white rounded-lg border border-gray-200 p-6 mb-8\">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div className=\"flex justify-between\">
        <div>
          {currentStep > 0 && (
            <button
              onClick={handlePrevious}
              disabled={isLoading}
              className=\"bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50\"
            >
              Previous
            </button>
          )}
        </div>
        
        <div className=\"flex space-x-3\">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className=\"bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50\"
          >
            Cancel
          </button>
          
          {currentStep < steps.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed() || isLoading}
              className=\"bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50\"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleDeploy}
              disabled={!canProceed() || isLoading}
              className=\"bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50\"
            >
              {isLoading ? 'Deploying...' : 'Deploy'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};


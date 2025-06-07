/**
 * Deployment Parameters Component
 * 
 * Allows users to configure template parameters and variables
 */

import React from 'react';
import { CloudTemplate } from '@/types/cloud';

interface DeploymentParametersProps {
  template: CloudTemplate;
  parameters: Record<string, any>;
  variables: Record<string, any>;
  onParametersChange: (parameters: Record<string, any>) => void;
  onVariablesChange: (variables: Record<string, any>) => void;
}

export const DeploymentParameters: React.FC<DeploymentParametersProps> = ({
  template,
  parameters,
  variables,
  onParametersChange,
  onVariablesChange
}) => {
  const handleParameterChange = (key: string, value: any) => {
    onParametersChange({
      ...parameters,
      [key]: value
    });
  };

  const handleVariableChange = (key: string, value: any) => {
    onVariablesChange({
      ...variables,
      [key]: value
    });
  };

  const renderParameterInput = (key: string, param: any) => {
    const value = parameters[key] || param.value || '';
    
    switch (param.type) {
      case 'password':
        return (
          <input
            type=\"password\"
            value={value}
            onChange={(e) => handleParameterChange(key, e.target.value)}
            className=\"mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm\"
            placeholder={param.description}
          />
        );
      case 'int':
        return (
          <input
            type=\"number\"
            value={value}
            onChange={(e) => handleParameterChange(key, parseInt(e.target.value) || 0)}
            className=\"mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm\"
            placeholder={param.description}
          />
        );
      default:
        return (
          <input
            type=\"text\"
            value={value}
            onChange={(e) => handleParameterChange(key, e.target.value)}
            className=\"mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm\"
            placeholder={param.description}
          />
        );
    }
  };

  const renderVariableInput = (key: string, variable: any) => {
    const value = variables[key] || variable.value || '';
    
    if (variable.sensitive) {
      return (
        <input
          type=\"password\"
          value={value}
          onChange={(e) => handleVariableChange(key, e.target.value)}
          className=\"mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm\"
          placeholder={variable.description}
        />
      );
    }
    
    return (
      <input
        type=\"text\"
        value={value}
        onChange={(e) => handleVariableChange(key, e.target.value)}
        className=\"mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm\"
        placeholder={variable.description}
      />
    );
  };

  const hasParameters = template.parameters && Object.keys(template.parameters).length > 0;
  const hasVariables = template.variables && Object.keys(template.variables).length > 0;

  if (!hasParameters && !hasVariables) {
    return (
      <div className=\"space-y-4\">
        <h3 className=\"text-lg font-medium text-gray-900\">Configure Parameters</h3>
        <div className=\"text-center p-8 bg-gray-50 rounded-lg\">
          <svg className=\"mx-auto h-12 w-12 text-gray-400\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\">
            <path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z\" />
          </svg>
          <h3 className=\"mt-2 text-sm font-medium text-gray-900\">No configuration required</h3>
          <p className=\"mt-1 text-sm text-gray-500\">
            This template doesn't require any parameters or variables to be configured.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className=\"space-y-6\">
      <div>
        <h3 className=\"text-lg font-medium text-gray-900\">Configure Parameters</h3>
        <p className=\"text-sm text-gray-600 mt-1\">
          Set the parameters and variables for your template deployment
        </p>
      </div>

      {/* Parameters Section */}
      {hasParameters && (
        <div>
          <h4 className=\"text-md font-medium text-gray-900 mb-4\">Template Parameters</h4>
          <div className=\"space-y-4\">
            {Object.entries(template.parameters!).map(([key, param]) => (
              <div key={key}>
                <label className=\"block text-sm font-medium text-gray-700\">
                  {key}
                  {param.required && <span className=\"text-red-500 ml-1\">*</span>}
                </label>
                {renderParameterInput(key, param)}
                {param.description && (
                  <p className=\"mt-1 text-sm text-gray-500\">{param.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Variables Section */}
      {hasVariables && (
        <div className={hasParameters ? 'border-t pt-6' : ''}>
          <h4 className=\"text-md font-medium text-gray-900 mb-4\">Template Variables</h4>
          <div className=\"space-y-4\">
            {Object.entries(template.variables!).map(([key, variable]) => (
              <div key={key}>
                <label className=\"block text-sm font-medium text-gray-700\">
                  {key}
                  {variable.sensitive && (
                    <span className=\"ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800\">
                      Sensitive
                    </span>
                  )}
                </label>
                {renderVariableInput(key, variable)}
                {variable.description && (
                  <p className=\"mt-1 text-sm text-gray-500\">{variable.description}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help Text */}
      <div className=\"bg-blue-50 border border-blue-200 rounded-lg p-4\">
        <div className=\"flex\">
          <div className=\"flex-shrink-0\">
            <svg className=\"h-5 w-5 text-blue-400\" viewBox=\"0 0 20 20\" fill=\"currentColor\">
              <path fillRule=\"evenodd\" d=\"M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z\" clipRule=\"evenodd\" />
            </svg>
          </div>
          <div className=\"ml-3\">
            <h3 className=\"text-sm font-medium text-blue-800\">
              Configuration Tips
            </h3>
            <div className=\"mt-2 text-sm text-blue-700\">
              <ul className=\"list-disc list-inside space-y-1\">
                <li>Required parameters must be filled before deployment</li>
                <li>Sensitive variables are encrypted and not visible after saving</li>
                <li>Default values are pre-filled but can be modified</li>
                <li>You can leave optional parameters empty to use defaults</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


/**
 * Deployment error handling utilities
 */

import { DeploymentError } from '@/types/deployment';

export class DeploymentErrorHandler {
  /**
   * Parse and format deployment errors for user display
   */
  static parseError(error: any): DeploymentError {
    // Handle axios errors
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      switch (status) {
        case 401:
          return {
            code: 'UNAUTHORIZED',
            message: 'Your session has expired. Please log in again.',
            details: data
          };
        
        case 403:
          if (data.detail?.includes('deployment context')) {
            return {
              code: 'INVALID_DEPLOYMENT_CONTEXT',
              message: 'Your deployment session has expired. Please start a new deployment.',
              details: data
            };
          }
          return {
            code: 'FORBIDDEN',
            message: 'You don\'t have permission to perform this action.',
            details: data
          };
        
        case 404:
          return {
            code: 'NOT_FOUND',
            message: 'The requested resource was not found.',
            details: data
          };
        
        case 422:
          return {
            code: 'VALIDATION_ERROR',
            message: 'Invalid input data. Please check your configuration.',
            details: data
          };
        
        case 500:
          return {
            code: 'SERVER_ERROR',
            message: 'An internal server error occurred. Please try again later.',
            details: data
          };
        
        default:
          return {
            code: 'HTTP_ERROR',
            message: data.detail || data.message || 'An unexpected error occurred.',
            details: data
          };
      }
    }

    // Handle network errors
    if (error.code === 'ERR_NETWORK') {
      return {
        code: 'NETWORK_ERROR',
        message: 'Unable to connect to the server. Please check your internet connection.',
        details: error
      };
    }

    // Handle timeout errors
    if (error.code === 'ECONNABORTED') {
      return {
        code: 'TIMEOUT_ERROR',
        message: 'The request timed out. Please try again.',
        details: error
      };
    }

    // Handle deployment token errors
    if (error.message?.includes('deployment token')) {
      return {
        code: 'TOKEN_ERROR',
        message: 'Failed to obtain deployment authorization. Please try starting a new deployment.',
        details: error
      };
    }

    // Generic error
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || 'An unexpected error occurred.',
      details: error
    };
  }

  /**
   * Get user-friendly error message
   */
  static getUserMessage(error: DeploymentError): string {
    switch (error.code) {
      case 'INVALID_DEPLOYMENT_CONTEXT':
        return 'Your deployment session has expired. Please close this dialog and start a new deployment.';
      
      case 'UNAUTHORIZED':
        return 'Your login session has expired. Please refresh the page and log in again.';
      
      case 'FORBIDDEN':
        return 'You don\'t have permission to access this resource. Contact your administrator if you believe this is an error.';
      
      case 'VALIDATION_ERROR':
        return 'Please check your input and try again. Some required fields may be missing or invalid.';
      
      case 'NETWORK_ERROR':
        return 'Unable to connect to the server. Please check your internet connection and try again.';
      
      case 'TIMEOUT_ERROR':
        return 'The request took too long to complete. Please try again.';
      
      case 'TOKEN_ERROR':
        return 'Failed to authorize deployment. Please close this dialog and start a new deployment.';
      
      case 'SERVER_ERROR':
        return 'A server error occurred. Please try again in a few minutes.';
      
      default:
        return error.message;
    }
  }

  /**
   * Get suggested actions for error recovery
   */
  static getSuggestedActions(error: DeploymentError): string[] {
    switch (error.code) {
      case 'INVALID_DEPLOYMENT_CONTEXT':
      case 'TOKEN_ERROR':
        return [
          'Close the deployment dialog',
          'Start a new deployment from the template catalog',
          'Ensure you have the deploy:templates permission'
        ];
      
      case 'UNAUTHORIZED':
        return [
          'Refresh the page',
          'Log in again',
          'Contact support if the problem persists'
        ];
      
      case 'FORBIDDEN':
        return [
          'Contact your administrator',
          'Verify you have the correct permissions',
          'Check if your account has API access enabled'
        ];
      
      case 'VALIDATION_ERROR':
        return [
          'Check all required fields are filled',
          'Verify parameter values are correct',
          'Ensure environment and cloud account are selected'
        ];
      
      case 'NETWORK_ERROR':
        return [
          'Check your internet connection',
          'Try again in a few moments',
          'Contact IT support if the problem persists'
        ];
      
      case 'SERVER_ERROR':
        return [
          'Wait a few minutes and try again',
          'Contact support if the error continues',
          'Check the system status page'
        ];
      
      default:
        return [
          'Try the operation again',
          'Contact support if the problem persists'
        ];
    }
  }

  /**
   * Check if error is recoverable
   */
  static isRecoverable(error: DeploymentError): boolean {
    const recoverableCodes = [
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
      'SERVER_ERROR',
      'VALIDATION_ERROR'
    ];
    
    return recoverableCodes.includes(error.code);
  }

  /**
   * Check if error requires re-authentication
   */
  static requiresReauth(error: DeploymentError): boolean {
    return error.code === 'UNAUTHORIZED';
  }

  /**
   * Check if error requires new deployment session
   */
  static requiresNewSession(error: DeploymentError): boolean {
    return ['INVALID_DEPLOYMENT_CONTEXT', 'TOKEN_ERROR'].includes(error.code);
  }
}


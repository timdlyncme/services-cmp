/**
 * Cloud Account Selector Component
 * 
 * Allows users to select cloud accounts and subscriptions with secure token access
 */

import React, { useState, useEffect } from 'react';
import { CloudAccount } from '@/types/cloud';
import { deploymentService } from '@/services/deployment-service';

interface CloudAccountSelectorProps {
  tenantId: string;
  selectedCloudAccountId: string;
  selectedSubscriptionId?: string;
  onCloudAccountChange: (cloudAccountId: string) => void;
  onSubscriptionChange: (subscriptionId: string) => void;
}

export const CloudAccountSelector: React.FC<CloudAccountSelectorProps> = ({
  tenantId,
  selectedCloudAccountId,
  selectedSubscriptionId,
  onCloudAccountChange,
  onSubscriptionChange
}) => {
  const [cloudAccounts, setCloudAccounts] = useState<CloudAccount[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(true);
  const [isLoadingSubscriptions, setIsLoadingSubscriptions] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCloudAccounts = async () => {
      try {
        setIsLoadingAccounts(true);
        setError(null);
        
        // Use deployment-specific method that ensures token
        const accounts = await deploymentService.getCloudAccountsForDeployment(tenantId);
        setCloudAccounts(accounts);
      } catch (error) {
        console.error('Failed to load cloud accounts:', error);
        setError('Failed to load cloud accounts. Please try again.');
      } finally {
        setIsLoadingAccounts(false);
      }
    };

    loadCloudAccounts();
  }, [tenantId]);

  useEffect(() => {
    const loadSubscriptions = async () => {
      if (!selectedCloudAccountId) {
        setSubscriptions([]);
        return;
      }

      try {
        setIsLoadingSubscriptions(true);
        
        // Load subscriptions for the selected cloud account
        const selectedAccount = cloudAccounts.find(acc => acc.id === selectedCloudAccountId);
        if (selectedAccount && selectedAccount.provider === 'azure') {
          // For Azure accounts, load subscription locations
          const locations = await deploymentService.getSubscriptionLocations(
            tenantId,
            selectedCloudAccountId
          );
          setSubscriptions(locations.subscriptions || []);
        } else {
          // For other providers, we might have different logic
          setSubscriptions([]);
        }
      } catch (error) {
        console.error('Failed to load subscriptions:', error);
        setSubscriptions([]);
      } finally {
        setIsLoadingSubscriptions(false);
      }
    };

    loadSubscriptions();
  }, [selectedCloudAccountId, cloudAccounts, tenantId]);

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'bg-green-100 text-green-800';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoadingAccounts) {
    return (
      <div className=\"space-y-4\">
        <h3 className=\"text-lg font-medium text-gray-900\">Select Cloud Account</h3>
        <div className=\"flex items-center justify-center p-8\">
          <div className=\"animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600\"></div>
          <span className=\"ml-2 text-gray-600\">Loading cloud accounts...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className=\"space-y-4\">
        <h3 className=\"text-lg font-medium text-gray-900\">Select Cloud Account</h3>
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

  if (cloudAccounts.length === 0) {
    return (
      <div className=\"space-y-4\">
        <h3 className=\"text-lg font-medium text-gray-900\">Select Cloud Account</h3>
        <div className=\"text-center p-8 bg-gray-50 rounded-lg\">
          <svg className=\"mx-auto h-12 w-12 text-gray-400\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\">
            <path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={2} d=\"M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.002 4.002 0 003 15z\" />
          </svg>
          <h3 className=\"mt-2 text-sm font-medium text-gray-900\">No cloud accounts available</h3>
          <p className=\"mt-1 text-sm text-gray-500\">
            No cloud accounts are configured for this tenant.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className=\"space-y-6\">
      {/* Cloud Account Selection */}
      <div>
        <h3 className=\"text-lg font-medium text-gray-900\">Select Cloud Account</h3>
        <p className=\"text-sm text-gray-600 mt-1\">
          Choose the cloud account for your deployment
        </p>
      </div>

      <div className=\"space-y-3\">
        {cloudAccounts.map((account) => (
          <div
            key={account.id}
            className={`relative rounded-lg border p-4 cursor-pointer transition-colors ${
              selectedCloudAccountId === account.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            }`}
            onClick={() => onCloudAccountChange(account.id)}
          >
            <div className=\"flex items-start\">
              <div className=\"flex h-5 items-center\">
                <input
                  type=\"radio\"
                  name=\"cloudAccount\"
                  value={account.id}
                  checked={selectedCloudAccountId === account.id}
                  onChange={() => onCloudAccountChange(account.id)}
                  className=\"h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500\"
                />
              </div>
              <div className=\"ml-3 flex-1\">
                <div className=\"flex items-center space-x-3\">
                  {getProviderIcon(account.provider)}
                  <label className=\"text-sm font-medium text-gray-900 cursor-pointer\">
                    {account.name}
                  </label>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(account.status)}`}>
                    {account.status}
                  </span>
                </div>
                <p className=\"text-xs text-gray-500 mt-1 capitalize\">
                  {account.provider} Cloud Account
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Subscription Selection */}
      {selectedCloudAccountId && (
        <div className=\"border-t pt-6\">
          <div>
            <h4 className=\"text-md font-medium text-gray-900\">Select Subscription</h4>
            <p className=\"text-sm text-gray-600 mt-1\">
              Choose the subscription for your deployment
            </p>
          </div>

          {isLoadingSubscriptions ? (
            <div className=\"flex items-center justify-center p-6\">
              <div className=\"animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600\"></div>
              <span className=\"ml-2 text-gray-600\">Loading subscriptions...</span>
            </div>
          ) : subscriptions.length === 0 ? (
            <div className=\"text-center p-6 bg-gray-50 rounded-lg mt-3\">
              <p className=\"text-sm text-gray-500\">
                No subscriptions available for this account
              </p>
            </div>
          ) : (
            <div className=\"space-y-2 mt-3\">
              {subscriptions.map((subscription) => (
                <div
                  key={subscription.id}
                  className={`relative rounded-lg border p-3 cursor-pointer transition-colors ${
                    selectedSubscriptionId === subscription.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => onSubscriptionChange(subscription.id)}
                >
                  <div className=\"flex items-center\">
                    <input
                      type=\"radio\"
                      name=\"subscription\"
                      value={subscription.id}
                      checked={selectedSubscriptionId === subscription.id}
                      onChange={() => onSubscriptionChange(subscription.id)}
                      className=\"h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500\"
                    />
                    <div className=\"ml-3 flex-1\">
                      <label className=\"text-sm font-medium text-gray-900 cursor-pointer\">
                        {subscription.name || subscription.displayName}
                      </label>
                      <p className=\"text-xs text-gray-500\">
                        ID: {subscription.id}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Selection Summary */}
      {selectedCloudAccountId && (
        <div className=\"mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg\">
          <div className=\"flex items-center\">
            <svg className=\"h-5 w-5 text-blue-400\" viewBox=\"0 0 20 20\" fill=\"currentColor\">
              <path fillRule=\"evenodd\" d=\"M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z\" clipRule=\"evenodd\" />
            </svg>
            <div className=\"ml-2 text-sm text-blue-700\">
              <span>Cloud account selected: </span>
              <strong>{cloudAccounts.find(acc => acc.id === selectedCloudAccountId)?.name}</strong>
              {selectedSubscriptionId && (
                <>
                  <br />
                  <span>Subscription: </span>
                  <strong>{subscriptions.find(sub => sub.id === selectedSubscriptionId)?.name || selectedSubscriptionId}</strong>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


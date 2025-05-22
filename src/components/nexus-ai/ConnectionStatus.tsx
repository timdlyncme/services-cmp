import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAzureOpenAI } from '@/contexts/AzureOpenAIContext';
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface ConnectionStatusProps {
  onRefresh?: () => void;
}

export function ConnectionStatus({ onRefresh }: ConnectionStatusProps) {
  const { 
    isConfigured, 
    isConnected, 
    connectionStatus, 
    testConnection, 
    addLog,
    connectionError,
    setConnectionChecked,
    setConnectionStatus,
    lastCheckedTime
  } = useAzureOpenAI();

  const handleRefresh = async () => {
    // If already connecting, don't trigger another refresh
    if (connectionStatus === 'connecting') {
      return;
    }
    
    addLog('Manually refreshing connection status', 'info');
    // Reset the connection checked flag to force a new check
    setConnectionChecked(false);
    setConnectionStatus('connecting');
    await testConnection();
    if (onRefresh) {
      onRefresh();
    }
  };

  // Format the last checked time
  const getLastCheckedText = () => {
    if (!lastCheckedTime) return 'Never checked';
    
    // Format as relative time (e.g., "2 minutes ago")
    const now = new Date();
    const diffMs = now.getTime() - lastCheckedTime.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec} seconds ago`;
    
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
    
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
    
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  };

  const getStatusBadge = () => {
    if (!isConfigured) {
      return (
        <Badge variant="outline" className="ml-2">
          <AlertCircle className="h-4 w-4 mr-1" />
          Not Configured
        </Badge>
      );
    }

    switch (connectionStatus) {
      case 'connected':
        return (
          <Badge variant="success" className="ml-2">
            <CheckCircle className="h-4 w-4 mr-1" />
            Connected
          </Badge>
        );
      case 'connecting':
        return (
          <Badge variant="outline" className="ml-2">
            <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
            Connecting
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" className="ml-2">
            <XCircle className="h-4 w-4 mr-1" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="ml-2">
            <AlertCircle className="h-4 w-4 mr-1" />
            Disconnected
          </Badge>
        );
    }
  };

  return (
    <div className="flex items-center">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center">
              {getStatusBadge()}
              <Button
                variant="ghost"
                size="icon"
                className="ml-1"
                onClick={handleRefresh}
                disabled={connectionStatus === 'connecting'}
              >
                <RefreshCw className={`h-4 w-4 ${connectionStatus === 'connecting' ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p>
                {!isConfigured 
                  ? 'Azure OpenAI is not configured. Click Configure to set it up.' 
                  : connectionStatus === 'connected'
                    ? 'Connected to Azure OpenAI'
                    : connectionStatus === 'connecting'
                      ? 'Connecting to Azure OpenAI...'
                      : connectionError
                        ? `Failed to connect: ${connectionError}`
                        : 'Failed to connect to Azure OpenAI. Check your configuration.'}
              </p>
              {lastCheckedTime && (
                <p className="text-xs text-muted-foreground">
                  Last checked: {getLastCheckedText()}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

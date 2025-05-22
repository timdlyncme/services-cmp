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
    setConnectionStatus
  } = useAzureOpenAI();

  const handleRefresh = async () => {
    // If already connecting, don't trigger another refresh
    if (connectionStatus === 'connecting') {
      return;
    }
    
    addLog('Refreshing connection status', 'info');
    // Reset the connection checked flag to force a new check
    setConnectionChecked(false);
    setConnectionStatus('connecting');
    await testConnection();
    if (onRefresh) {
      onRefresh();
    }
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
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

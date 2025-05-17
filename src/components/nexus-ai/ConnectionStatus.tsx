import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { NexusAIService, ConnectionStatus as Status } from '@/services/nexus-ai-service';
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface ConnectionStatusProps {
  onRefresh?: () => void;
}

export function ConnectionStatus({ onRefresh }: ConnectionStatusProps) {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const nexusAIService = new NexusAIService();

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      setLoading(true);
      const status = await nexusAIService.checkStatus();
      setStatus(status);
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to check status:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    if (!status) {
      return (
        <Badge variant="outline" className="ml-2">
          <AlertCircle className="h-4 w-4 mr-1" />
          Unknown
        </Badge>
      );
    }

    switch (status.status) {
      case 'connected':
        return (
          <Badge variant="success" className="ml-2">
            <CheckCircle className="h-4 w-4 mr-1" />
            Connected
          </Badge>
        );
      case 'not_configured':
        return (
          <Badge variant="outline" className="ml-2">
            <AlertCircle className="h-4 w-4 mr-1" />
            Not Configured
          </Badge>
        );
      case 'deployment_not_found':
        return (
          <Badge variant="warning" className="ml-2">
            <AlertCircle className="h-4 w-4 mr-1" />
            Deployment Not Found
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
            Unknown
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
                onClick={checkStatus}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{status?.message || 'Check connection status'}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}


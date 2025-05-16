import React from "react";
import { useAzureOpenAI } from "@/contexts/AzureOpenAIContext";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

const ConnectionStatus: React.FC = () => {
  const { connectionStatus, isConfigured } = useAzureOpenAI();

  if (!isConfigured) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1 text-gray-400">
              <AlertCircle className="h-3 w-3" />
              Not Configured
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Azure OpenAI is not configured. Click Configure to set up.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const getStatusDetails = () => {
    switch (connectionStatus) {
      case "connected":
        return {
          icon: <CheckCircle2 className="h-3 w-3" />,
          text: "Connected",
          variant: "success" as const,
          tooltip: "Successfully connected to Azure OpenAI",
        };
      case "connecting":
        return {
          icon: <Loader2 className="h-3 w-3 animate-spin" />,
          text: "Connecting...",
          variant: "outline" as const,
          tooltip: "Attempting to connect to Azure OpenAI",
        };
      case "error":
        return {
          icon: <AlertCircle className="h-3 w-3" />,
          text: "Connection Error",
          variant: "destructive" as const,
          tooltip: "Failed to connect to Azure OpenAI. Check logs for details.",
        };
      default:
        return {
          icon: <AlertCircle className="h-3 w-3" />,
          text: "Not Connected",
          variant: "outline" as const,
          tooltip: "Azure OpenAI is configured but not connected",
        };
    }
  };

  const { icon, text, variant, tooltip } = getStatusDetails();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant={variant} className="gap-1">
            {icon}
            {text}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export default ConnectionStatus;


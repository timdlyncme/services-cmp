import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { toast } from "sonner";
import { NexusAIService } from "@/services/nexus-ai-service";

interface AzureOpenAIConfig {
  apiKey: string;
  endpoint: string;
  deploymentName: string;
  apiVersion: string;
}

export type LogLevel = "info" | "error" | "warning" | "success" | "request" | "response";

export interface LogEntry {
  timestamp: string;
  message: string;
  level: LogLevel;
  details?: any;
}

interface AzureOpenAIContextType {
  config: AzureOpenAIConfig;
  updateConfig: (newConfig: Partial<AzureOpenAIConfig>) => void;
  isConfigured: boolean;
  isConnected: boolean;
  connectionStatus: "disconnected" | "connecting" | "connected" | "error";
  setConnectionStatus: (status: "disconnected" | "connecting" | "connected" | "error") => void;
  testConnection: () => Promise<boolean>;
  logs: LogEntry[];
  addLog: (message: string, level: LogLevel, details?: any) => void;
  clearLogs: () => void;
  connectionError: string | null;
  setConnectionError: (error: string | null) => void;
  connectionChecked: boolean;
  setConnectionChecked: (checked: boolean) => void;
}

const defaultConfig: AzureOpenAIConfig = {
  apiKey: "",
  endpoint: "",
  deploymentName: "",
  apiVersion: "2023-05-15",
};

const AzureOpenAIContext = createContext<AzureOpenAIContextType | undefined>(undefined);

export const AzureOpenAIProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AzureOpenAIConfig>(() => {
    // Try to load from localStorage
    const savedConfig = localStorage.getItem("azureOpenAIConfig");
    return savedConfig ? JSON.parse(savedConfig) : defaultConfig;
  });
  
  const [connectionStatus, setConnectionStatus] = useState<"disconnected" | "connecting" | "connected" | "error">("disconnected");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionChecked, setConnectionChecked] = useState<boolean>(false);

  const isConfigured = Boolean(config.apiKey && config.endpoint && config.deploymentName);
  const isConnected = connectionStatus === "connected";

  // Save config to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("azureOpenAIConfig", JSON.stringify(config));
  }, [config]);

  const updateConfig = (newConfig: Partial<AzureOpenAIConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
    // Reset connection status when config changes
    setConnectionStatus("disconnected");
    addLog("Configuration updated", "info");
  };

  const addLog = (message: string, level: LogLevel = "info", details?: any) => {
    const timestamp = new Date().toISOString();
    setLogs(prev => [...prev, { timestamp, message, level, details }]);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const testConnection = async (): Promise<boolean> => {
    if (!isConfigured) {
      toast.error("Please configure Azure OpenAI settings first");
      addLog("Connection test failed: Missing configuration", "error");
      setConnectionChecked(true);
      return false;
    }

    // If we've already checked the connection and it failed, don't try again
    // unless explicitly requested via the refresh button
    if (connectionChecked && connectionStatus === "error") {
      return false;
    }

    setConnectionStatus("connecting");
    addLog("Testing connection to Azure OpenAI...", "info");
    addLog(`Endpoint: ${config.endpoint}/openai/deployments/${config.deploymentName}`, "info");

    try {
      // Use the NexusAI service to check the connection status
      const nexusAIService = new NexusAIService();
      const status = await nexusAIService.checkStatus();
      
      setConnectionChecked(true);
      
      if (status.status === "connected") {
        setConnectionStatus("connected");
        setConnectionError(null);
        addLog("Connection successful", "success");
        toast.success("Successfully connected to Azure OpenAI");
        return true;
      } else {
        setConnectionStatus("error");
        setConnectionError(status.message);
        addLog(`Connection error: ${status.message}`, "error");
        toast.error(`Failed to connect: ${status.message}`);
        return false;
      }
    } catch (error) {
      setConnectionStatus("error");
      setConnectionChecked(true);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setConnectionError(errorMessage);
      addLog(`Connection error: ${errorMessage}`, "error", error);
      toast.error(`Failed to connect: ${errorMessage}`);
      return false;
    }
  };

  return (
    <AzureOpenAIContext.Provider
      value={{
        config,
        updateConfig,
        isConfigured,
        isConnected,
        connectionStatus,
        setConnectionStatus,
        testConnection,
        logs,
        addLog,
        clearLogs,
        connectionError,
        setConnectionError,
        connectionChecked,
        setConnectionChecked,
      }}
    >
      {children}
    </AzureOpenAIContext.Provider>
  );
};

export const useAzureOpenAI = (): AzureOpenAIContextType => {
  const context = useContext(AzureOpenAIContext);
  if (context === undefined) {
    throw new Error("useAzureOpenAI must be used within an AzureOpenAIProvider");
  }
  return context;
};

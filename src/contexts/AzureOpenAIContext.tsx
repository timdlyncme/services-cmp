import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { toast } from "sonner";

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
  testConnection: () => Promise<boolean>;
  logs: LogEntry[];
  addLog: (message: string, level: LogLevel, details?: any) => void;
  clearLogs: () => void;
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
      return false;
    }

    setConnectionStatus("connecting");
    addLog("Testing connection to Azure OpenAI...", "info");
    addLog(`Endpoint: ${config.endpoint}/openai/deployments/${config.deploymentName}`, "info");

    try {
      // Simple test request to Azure OpenAI
      const requestBody = {
        messages: [{ role: "system", content: "You are a helpful assistant." }],
        max_tokens: 5,
      };
      
      addLog("Sending test request to Azure OpenAI", "request", requestBody);
      
      const response = await fetch(`${config.endpoint}/openai/deployments/${config.deploymentName}/chat/completions?api-version=${config.apiVersion}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": config.apiKey,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        addLog(`Response status: ${response.status} ${response.statusText}`, "error", errorData);
        throw new Error(errorData?.error?.message || `HTTP error ${response.status}`);
      }

      const responseData = await response.json();
      addLog("Received successful response from Azure OpenAI", "response", responseData);
      
      setConnectionStatus("connected");
      addLog("Connection successful", "success");
      toast.success("Successfully connected to Azure OpenAI");
      return true;
    } catch (error) {
      setConnectionStatus("error");
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
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
        testConnection,
        logs,
        addLog,
        clearLogs,
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

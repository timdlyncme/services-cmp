import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from "react";
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
  lastCheckedTime: Date | null;
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
  const [lastCheckedTime, setLastCheckedTime] = useState<Date | null>(null);
  const connectionCheckTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isTestingConnection = useRef<boolean>(false);

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

  // Memoize testConnection to avoid recreating it on every render
  const testConnection = useCallback(async (): Promise<boolean> => {
    if (!isConfigured) {
      toast.error("Please configure Azure OpenAI settings first");
      addLog("Connection test failed: Missing configuration", "error");
      setConnectionChecked(true);
      return false;
    }

    // If already testing connection, don't start another test
    if (isTestingConnection.current) {
      return false;
    }

    isTestingConnection.current = true;
    setConnectionStatus("connecting");
    addLog("Testing connection to Azure OpenAI...", "info");
    addLog(`Endpoint: ${config.endpoint}/openai/deployments/${config.deploymentName}`, "info");

    try {
      // Use the NexusAI service to check the connection status
      const nexusAIService = new NexusAIService();
      const status = await nexusAIService.checkStatus();
      
      setConnectionChecked(true);
      setLastCheckedTime(new Date());
      
      if (status.status === "connected") {
        setConnectionStatus("connected");
        setConnectionError(null);
        addLog("Connection successful", "success");
        isTestingConnection.current = false;
        return true;
      } else {
        setConnectionStatus("error");
        setConnectionError(status.message);
        addLog(`Connection error: ${status.message}`, "error");
        isTestingConnection.current = false;
        return false;
      }
    } catch (error) {
      setConnectionStatus("error");
      setConnectionChecked(true);
      setLastCheckedTime(new Date());
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      setConnectionError(errorMessage);
      addLog(`Connection error: ${errorMessage}`, "error", error);
      isTestingConnection.current = false;
      return false;
    }
  }, [isConfigured, config, addLog]);

  // Set up periodic connection check (every 30 seconds)
  useEffect(() => {
    // Clear any existing timer when component unmounts or dependencies change
    if (connectionCheckTimerRef.current) {
      clearInterval(connectionCheckTimerRef.current);
      connectionCheckTimerRef.current = null;
    }

    // Only set up timer if configured
    if (isConfigured) {
      // Initial check if not already checked
      if (!connectionChecked) {
        testConnection();
      }

      // Set up periodic check every 30 seconds
      connectionCheckTimerRef.current = setInterval(() => {
        // Only check if not already in the process of checking
        if (!isTestingConnection.current) {
          addLog("Performing periodic connection check", "info");
          testConnection();
        }
      }, 30000); // 30 seconds
    }

    // Cleanup function
    return () => {
      if (connectionCheckTimerRef.current) {
        clearInterval(connectionCheckTimerRef.current);
        connectionCheckTimerRef.current = null;
      }
    };
  }, [isConfigured, connectionChecked, testConnection]);

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
        lastCheckedTime,
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

export interface AzureOpenAIConfig {
  apiKey: string;
  endpoint: string;
  deploymentName: string;
  apiVersion: string;
}

export interface Message {
  id: string;
  sender: "user" | "ai";
  content: string;
  timestamp: string;
}

export interface AIInsight {
  id: string;
  title: string;
  description: string;
  category: "deployment" | "tenant" | "template" | "security";
  severity: "low" | "medium" | "high";
  timestamp: string;
}


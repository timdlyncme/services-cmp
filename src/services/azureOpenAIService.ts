import { AzureOpenAIConfig } from "@/types/azure-openai";
import { LogLevel } from "@/contexts/AzureOpenAIContext";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class AzureOpenAIService {
  private config: AzureOpenAIConfig;
  private onLogCallback?: (message: string, level: LogLevel, details?: any) => void;

  constructor(config: AzureOpenAIConfig, onLog?: (message: string, level: LogLevel, details?: any) => void) {
    this.config = config;
    this.onLogCallback = onLog;
  }

  private log(message: string, level: LogLevel = "info", details?: any) {
    if (this.onLogCallback) {
      this.onLogCallback(message, level, details);
    }
  }

  public async sendChatCompletion(
    messages: ChatMessage[],
    options: {
      temperature?: number;
      max_tokens?: number;
    } = {}
  ): Promise<string> {
    const { apiKey, endpoint, deploymentName, apiVersion } = this.config;

    if (!apiKey || !endpoint || !deploymentName) {
      this.log("Missing Azure OpenAI configuration", "error");
      throw new Error("Azure OpenAI is not properly configured");
    }

    try {
      this.log(`Preparing request to Azure OpenAI with ${messages.length} messages`, "info");
      
      const requestUrl = `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`;
      this.log(`Request URL: ${requestUrl}`, "info");
      
      const requestBody = {
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.max_tokens ?? 800,
      };
      
      this.log("Sending request to Azure OpenAI", "request", {
        url: requestUrl,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Don't log the actual API key
          "api-key": "********"
        },
        body: requestBody
      });
      
      const startTime = Date.now();
      const response = await fetch(
        requestUrl,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": apiKey,
          },
          body: JSON.stringify(requestBody),
        }
      );
      const endTime = Date.now();
      const requestDuration = endTime - startTime;
      
      this.log(`Response received in ${requestDuration}ms`, "info");
      this.log(`Response status: ${response.status} ${response.statusText}`, "info");

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.error?.message || `HTTP error ${response.status}`;
        this.log(`Error from Azure OpenAI: ${errorMessage}`, "error", errorData);
        throw new Error(errorMessage);
      }

      const data = await response.json() as ChatCompletionResponse;
      this.log(`Received response from Azure OpenAI`, "response", {
        id: data.id,
        model: data.model,
        usage: data.usage,
        choices: data.choices.map(c => ({
          finish_reason: c.finish_reason,
          content_length: c.message.content.length
        }))
      });
      
      this.log(`Tokens used: ${data.usage.total_tokens} (prompt: ${data.usage.prompt_tokens}, completion: ${data.usage.completion_tokens})`, "info");
      
      return data.choices[0].message.content;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.log(`Error in sendChatCompletion: ${errorMessage}`, "error", error);
      throw error;
    }
  }
}

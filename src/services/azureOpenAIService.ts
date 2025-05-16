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

export interface ChatCompletionChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      role?: string;
      content?: string;
    };
    finish_reason: string | null;
  }[];
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
      stream?: boolean;
      onChunk?: (chunk: string) => void;
    } = {}
  ): Promise<string> {
    const { apiKey, endpoint, deploymentName, apiVersion } = this.config;
    const { stream = false, onChunk } = options;

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
        stream,
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
      
      this.log(`Response status: ${response.status} ${response.statusText}`, "info");

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.error?.message || `HTTP error ${response.status}`;
        this.log(`Error from Azure OpenAI: ${errorMessage}`, "error", errorData);
        throw new Error(errorMessage);
      }

      if (stream && onChunk) {
        // Handle streaming response
        const reader = response.body?.getReader();
        const decoder = new TextDecoder("utf-8");
        let fullContent = "";
        
        if (!reader) {
          throw new Error("Failed to get response reader");
        }
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk
              .split("\n")
              .filter(line => line.trim() !== "" && line.trim() !== "data: [DONE]");
            
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const jsonData = JSON.parse(line.substring(6)) as ChatCompletionChunk;
                  const content = jsonData.choices[0]?.delta?.content || "";
                  if (content) {
                    fullContent += content;
                    onChunk(content);
                  }
                } catch (e) {
                  this.log(`Error parsing chunk: ${line}`, "error", e);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
        
        const endTime = Date.now();
        const requestDuration = endTime - startTime;
        this.log(`Streaming completed in ${requestDuration}ms`, "info");
        
        return fullContent;
      } else {
        // Handle non-streaming response
        const data = await response.json() as ChatCompletionResponse;
        const endTime = Date.now();
        const requestDuration = endTime - startTime;
        
        this.log(`Response received in ${requestDuration}ms`, "info");
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
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.log(`Error in sendChatCompletion: ${errorMessage}`, "error", error);
      throw error;
    }
  }
}

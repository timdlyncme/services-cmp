import { AzureOpenAIConfig } from "@/types/azure-openai";

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
  private onLogCallback?: (message: string) => void;

  constructor(config: AzureOpenAIConfig, onLog?: (message: string) => void) {
    this.config = config;
    this.onLogCallback = onLog;
  }

  private log(message: string) {
    if (this.onLogCallback) {
      this.onLogCallback(message);
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
      this.log("Missing Azure OpenAI configuration");
      throw new Error("Azure OpenAI is not properly configured");
    }

    try {
      this.log(`Sending request to Azure OpenAI (${messages.length} messages)`);
      
      const response = await fetch(
        `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": apiKey,
          },
          body: JSON.stringify({
            messages,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.max_tokens ?? 800,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const errorMessage = errorData?.error?.message || `HTTP error ${response.status}`;
        this.log(`Error from Azure OpenAI: ${errorMessage}`);
        throw new Error(errorMessage);
      }

      const data = await response.json() as ChatCompletionResponse;
      this.log(`Received response from Azure OpenAI (${data.usage.total_tokens} tokens used)`);
      
      return data.choices[0].message.content;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.log(`Error in sendChatCompletion: ${errorMessage}`);
      throw error;
    }
  }
}


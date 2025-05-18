import axios from 'axios';

// API base URL
const API_URL = 'http://localhost:8000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
}

export interface ChatResponse {
  message: ChatMessage;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

export interface AzureOpenAIConfig {
  api_key: string;
  endpoint: string;
  deployment_name: string;
  api_version: string;
}

export interface ConnectionStatus {
  status: 'connected' | 'not_configured' | 'deployment_not_found' | 'error';
  message: string;
}

export class NexusAIService {
  /**
   * Send a chat request to Azure OpenAI
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await api.post('/nexus-ai/chat', request, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Chat error:', error);
      if (axios.isAxiosError(error)) {
        if (error.code === 'ERR_NETWORK') {
          throw new Error('Cannot connect to AI service. Please make sure the server is running.');
        } else if (error.response) {
          throw new Error(error.response.data.detail || 'Chat request failed');
        }
      }
      throw error;
    }
  }

  /**
   * Get Azure OpenAI configuration
   */
  async getConfig(): Promise<AzureOpenAIConfig> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await api.get('/nexus-ai/config', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Get config error:', error);
      throw error;
    }
  }

  /**
   * Update Azure OpenAI configuration
   */
  async updateConfig(config: AzureOpenAIConfig): Promise<AzureOpenAIConfig> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await api.post('/nexus-ai/config', config, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Update config error:', error);
      throw error;
    }
  }

  /**
   * Check Azure OpenAI connection status
   */
  async checkStatus(): Promise<ConnectionStatus> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await api.get('/nexus-ai/status', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('Check status error:', error);
      return {
        status: 'error',
        message: 'Failed to check connection status'
      };
    }
  }
}

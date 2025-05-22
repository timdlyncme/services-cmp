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
  max_completion_tokens?: number;
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];
  stream?: boolean;
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
   * Stream a chat request to Azure OpenAI
   */
  streamChat(request: ChatRequest, onMessage: (content: string) => void, onError: (error: string) => void, onComplete: () => void): () => void {
    const token = localStorage.getItem('token');
    if (!token) {
      onError('Authentication required');
      return () => {};
    }

    // Set up request data
    const requestData = {
      ...request,
      stream: true
    };

    // Create a controller to abort the fetch request
    const controller = new AbortController();
    const { signal } = controller;

    // Start the streaming request
    fetch(`${API_URL}/nexus-ai/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(requestData),
      signal
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Set up the event source reader
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Response body is not readable');
      }
      
      // Process the stream
      const processStream = async () => {
        const decoder = new TextDecoder();
        let buffer = '';
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              onComplete();
              break;
            }
            
            // Decode the chunk and add it to our buffer
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            
            // Process any complete SSE messages in the buffer
            const lines = buffer.split('\n\n');
            buffer = lines.pop() || ''; // Keep the last incomplete chunk in the buffer
            
            for (const line of lines) {
              if (line.trim() === '') continue;
              
              if (line.startsWith('data: ')) {
                const data = line.substring(6); // Remove 'data: ' prefix
                
                if (data === '[DONE]') {
                  onComplete();
                  return;
                }
                
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.error) {
                    onError(parsed.error);
                    return;
                  }
                  if (parsed.content) {
                    onMessage(parsed.content);
                  }
                } catch (e) {
                  console.error('Error parsing SSE data:', e, data);
                }
              }
            }
          }
        } catch (error) {
          if (error.name === 'AbortError') {
            console.log('Fetch aborted');
          } else {
            console.error('Error reading stream:', error);
            onError(error instanceof Error ? error.message : 'Error reading stream');
          }
        }
      };
      
      processStream();
    })
    .catch(error => {
      console.error('Fetch error:', error);
      onError(error instanceof Error ? error.message : 'Failed to start streaming');
    });

    // Return a function to abort the fetch
    return () => {
      controller.abort();
    };
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
        message: error instanceof Error ? error.message : 'Failed to check connection status'
      };
    }
  }
}

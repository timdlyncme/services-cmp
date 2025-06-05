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
  template_data?: any; // Template data to provide context
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
  model: string;
  api_version: string;
}

export interface AzureOpenAIConfigUpdate {
  api_key?: string;
  endpoint?: string;
  deployment_name?: string;
  model?: string;
  api_version?: string;
}


export interface ConnectionStatus {
  status: 'connected' | 'not_configured' | 'deployment_not_found' | 'error';
  message: string;
}

export class AIAssistantService {
  /**
   * Send a chat request to Azure OpenAI
   */
  async chat(request: ChatRequest, tenantId?: string): Promise<ChatResponse> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const params = tenantId ? { tenant_id: tenantId } : {};
      const response = await api.post('/ai-assistant/chat', request, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params
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
  streamChat(request: ChatRequest, onMessage: (content: string) => void, onError: (error: string) => void, onComplete: () => void, tenantId?: string): () => void {
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

    // Log the request data for debugging
    console.log("Sending chat request with template data:", requestData);

    // Create a controller to abort the fetch request
    const controller = new AbortController();
    const { signal } = controller;

    // Build URL with tenant_id if provided
    const url = new URL(`${API_URL}/ai-assistant/stream`);
    if (tenantId) {
      url.searchParams.append('tenant_id', tenantId);
    }

    // Start the streaming request
    fetch(url.toString(), {
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
              // Make sure to call onComplete when done
              onComplete();
              break;
            }
            
            // Decode the chunk and add it to our buffer
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            
            // Process any complete SSE messages in the buffer
            // Split by double newlines which is the SSE message separator
            const lines = buffer.split('\n\n');
            
            // Keep the last potentially incomplete chunk in the buffer
            buffer = lines.pop() || '';
            
            for (const line of lines) {
              if (line.trim() === '') continue;
              
              // Check if the line starts with 'data: '
              if (line.startsWith('data: ')) {
                const data = line.substring(6).trim(); // Remove 'data: ' prefix and trim
                
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
              } else {
                // Handle non-data lines if needed
                console.log('Received non-data line:', line);
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
        } finally {
          // Always call onComplete in finally block to ensure it's called
          onComplete();
        }
      };
      
      processStream();
    })
    .catch(error => {
      console.error('Fetch error:', error);
      onError(error instanceof Error ? error.message : 'Failed to start streaming');
      // Make sure to call onComplete even on error
      onComplete();
    });

    // Return a function to abort the fetch
    return () => {
      controller.abort();
    };
  }

  /**
   * Get Azure OpenAI configuration
   */
  async getConfig(tenantId?: string): Promise<AzureOpenAIConfig> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const params = tenantId ? { tenant_id: tenantId } : {};
      const response = await api.get('/ai-assistant/config', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params
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
  async updateConfig(config: AzureOpenAIConfigUpdate, tenantId?: string): Promise<AzureOpenAIConfig> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const params = tenantId ? { tenant_id: tenantId } : {};
      const response = await api.post('/ai-assistant/config', config, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params
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
  async checkStatus(tenantId?: string): Promise<ConnectionStatus> {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }

      const params = tenantId ? { tenant_id: tenantId } : {};
      const response = await api.get('/ai-assistant/status', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params,
        // Add a timeout to prevent hanging requests
        timeout: 5000
      });
      
      const data = response.data;
      
      // Map the backend status to our frontend status format
      if (data.status === 'connected') {
        return {
          status: 'connected',
          message: 'Successfully connected to Azure OpenAI'
        };
      } else if (data.status === 'not_configured') {
        return {
          status: 'not_configured',
          message: 'Azure OpenAI is not configured'
        };
      } else {
        return {
          status: 'error',
          message: data.error || 'Failed to connect to Azure OpenAI'
        };
      }
    } catch (error) {
      console.error('Check status error:', error);
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to check connection status'
      };
    }
  }
}

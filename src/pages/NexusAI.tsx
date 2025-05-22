import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { ConfigDialog } from '@/components/nexus-ai/ConfigDialog';
import { ConnectionStatus } from '@/components/nexus-ai/ConnectionStatus';
import { DebugLogs } from '@/components/nexus-ai/DebugLogs';
import { ChatMessage as ChatMessageComponent } from '@/components/nexus-ai/ChatMessage';
import { NexusAIService, ChatMessage } from '@/services/nexus-ai-service';
import { useAzureOpenAI } from '@/contexts/AzureOpenAIContext';
import { Send } from 'lucide-react';

export default function NexusAI() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'system',
      content: 'I am NexusAI, your cloud management assistant. How can I help you today?'
    },
    {
      role: 'assistant',
      content: 'Hello! I\'m NexusAI, your cloud management assistant. I can help you with managing cloud resources, understanding templates, and answering questions about cloud services. How can I assist you today?'
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const [streamController, setStreamController] = useState<(() => void) | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const nexusAIService = new NexusAIService();
  const { 
    isConfigured, 
    isConnected, 
    connectionStatus, 
    testConnection, 
    logs, 
    addLog, 
    connectionChecked 
  } = useAzureOpenAI();

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Check connection status on component mount, but only once
    if (isConfigured && !isConnected && !connectionChecked) {
      testConnection();
    }
  }, [isConfigured, isConnected, testConnection, connectionChecked]);

  // Cleanup streaming on unmount
  useEffect(() => {
    return () => {
      if (streamController) {
        streamController();
      }
    };
  }, [streamController]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input
    };

    setMessages((prevMessages) => [...prevMessages, userMessage]);
    setInput('');
    setLoading(true);
    setStreamingMessage('');

    try {
      addLog(`Sending message: ${input}`, 'info');
      
      // Add a placeholder message for streaming
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          role: 'assistant',
          content: ''
        }
      ]);

      // Use streaming API
      const controller = nexusAIService.streamChat(
        {
          messages: [...messages, userMessage]
        },
        // On message chunk received
        (content: string) => {
          setStreamingMessage((prev) => prev + content);
          
          // Update the last message with the accumulated content
          setMessages((prevMessages) => {
            const updatedMessages = [...prevMessages];
            updatedMessages[updatedMessages.length - 1] = {
              role: 'assistant',
              content: updatedMessages[updatedMessages.length - 1].content + content
            };
            return updatedMessages;
          });
        },
        // On error
        (error: string) => {
          console.error('Streaming error:', error);
          addLog(`Error: ${error}`, 'error');
          
          toast({
            title: 'Error',
            description: error,
            variant: 'destructive',
          });
          
          // Update the placeholder message with an error message
          setMessages((prevMessages) => {
            const updatedMessages = [...prevMessages];
            updatedMessages[updatedMessages.length - 1] = {
              role: 'assistant',
              content: 'I apologize, but I encountered an error processing your request. Please check the connection status and try again.'
            };
            return updatedMessages;
          });
          
          setLoading(false);
          setStreamController(null);
        },
        // On complete
        () => {
          addLog(`Streaming completed`, 'info');
          setLoading(false);
          setStreamController(null);
        }
      );
      
      setStreamController(() => controller);
    } catch (error) {
      console.error('Chat error:', error);
      addLog(`Error: ${error instanceof Error ? error.message : String(error)}`, 'error');
      
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send message',
        variant: 'destructive',
      });
      
      // Add error message from assistant
      setMessages((prevMessages) => {
        // If we already added a placeholder message, update it
        if (prevMessages[prevMessages.length - 1].role === 'assistant' && prevMessages[prevMessages.length - 1].content === '') {
          const updatedMessages = [...prevMessages];
          updatedMessages[updatedMessages.length - 1] = {
            role: 'assistant',
            content: 'I apologize, but I encountered an error processing your request. Please check the connection status and try again.'
          };
          return updatedMessages;
        }
        
        // Otherwise add a new message
        return [
          ...prevMessages,
          {
            role: 'assistant',
            content: 'I apologize, but I encountered an error processing your request. Please check the connection status and try again.'
          }
        ];
      });
      
      setLoading(false);
      setStreamController(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCancelStream = () => {
    if (streamController) {
      streamController();
      setStreamController(null);
      setLoading(false);
      addLog('Streaming cancelled by user', 'info');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-2xl font-bold">NexusAI</h1>
        <div className="flex items-center space-x-2">
          <ConnectionStatus />
          <ConfigDialog />
          <DebugLogs logs={logs.map(log => ({
            timestamp: new Date(log.timestamp).toLocaleTimeString(),
            level: log.level === 'success' || log.level === 'request' || log.level === 'response' 
              ? 'info' 
              : (log.level as 'info' | 'error' | 'warning'),
            message: log.message
          }))} />
        </div>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages
            .filter((message) => message.role !== 'system')
            .map((message, index) => (
              <ChatMessageComponent key={index} message={message} />
            ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>
      
      <div className="p-4 border-t">
        <div className="flex items-center space-x-2">
          <Input
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading || !isConnected}
            className="flex-1"
          />
          {loading && streamController ? (
            <Button 
              onClick={handleCancelStream}
              variant="destructive"
            >
              Cancel
            </Button>
          ) : (
            <Button 
              onClick={handleSend} 
              disabled={loading || !input.trim() || !isConnected}
            >
              {loading ? (
                <span className="animate-spin">⏳</span>
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
        {!isConfigured && (
          <p className="text-sm text-muted-foreground mt-2">
            Please configure Azure OpenAI settings to start chatting.
          </p>
        )}
        {isConfigured && !isConnected && (
          <p className="text-sm text-muted-foreground mt-2">
            Connecting to Azure OpenAI...
          </p>
        )}
      </div>
    </div>
  );
}

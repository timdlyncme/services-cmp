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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const nexusAIService = new NexusAIService();
  const { 
    isConfigured, 
    isConnected, 
    connectionStatus, 
    testConnection, 
    logs, 
    addLog 
  } = useAzureOpenAI();

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Check connection status on component mount
    if (isConfigured && !isConnected) {
      testConnection();
    }
  }, [isConfigured, isConnected, testConnection]);

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

    try {
      addLog(`Sending message: ${input}`, 'info');
      
      const response = await nexusAIService.chat({
        messages: [...messages, userMessage]
      });
      
      addLog(`Received response: ${response.message.content.substring(0, 50)}...`, 'info');
      addLog(`Tokens used: ${response.usage.total_tokens}`, 'info');
      
      setMessages((prevMessages) => [...prevMessages, response.message]);
    } catch (error) {
      console.error('Chat error:', error);
      addLog(`Error: ${error instanceof Error ? error.message : String(error)}`, 'error');
      
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send message',
        variant: 'destructive',
      });
      
      // Add error message from assistant
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          role: 'assistant',
          content: 'I apologize, but I encountered an error processing your request. Please check the connection status and try again.'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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

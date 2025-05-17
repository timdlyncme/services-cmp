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
import { Send } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'error' | 'warning';
  message: string;
}

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
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const nexusAIService = new NexusAIService();

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const addLog = (level: 'info' | 'error' | 'warning', message: string) => {
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    setLogs((prevLogs) => [...prevLogs, { timestamp, level, message }]);
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
      addLog('info', `Sending message: ${input}`);
      
      const response = await nexusAIService.chat({
        messages: [...messages, userMessage]
      });
      
      addLog('info', `Received response: ${response.message.content.substring(0, 50)}...`);
      addLog('info', `Tokens used: ${response.usage.total_tokens}`);
      
      setMessages((prevMessages) => [...prevMessages, response.message]);
    } catch (error) {
      console.error('Chat error:', error);
      addLog('error', `Error: ${error instanceof Error ? error.message : String(error)}`);
      
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

  const handleRefresh = () => {
    addLog('info', 'Connection status refreshed');
  };

  const handleConfigUpdate = () => {
    addLog('info', 'Configuration updated');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <h1 className="text-2xl font-bold">NexusAI</h1>
        <div className="flex items-center space-x-2">
          <ConnectionStatus onRefresh={handleRefresh} />
          <ConfigDialog onConfigUpdate={handleConfigUpdate} />
          <DebugLogs logs={logs} />
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
            disabled={loading}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={loading || !input.trim()}>
            {loading ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

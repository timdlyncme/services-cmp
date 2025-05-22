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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
  const [isEditing, setIsEditing] = useState(false);
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
    if (isConfigured && !connectionChecked) {
      testConnection();
    }
  }, [isConfigured, testConnection, connectionChecked]);

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

    // If editing, replace the last user message
    if (isEditing) {
      // Find the index of the last user message
      const lastUserMessageIndex = [...messages].reverse().findIndex(msg => msg.role === 'user');
      if (lastUserMessageIndex !== -1) {
        // Convert from reverse index to actual index
        const actualIndex = messages.length - 1 - lastUserMessageIndex;
        
        // Create a new messages array with the edited message
        const newMessages = [...messages];
        newMessages[actualIndex] = userMessage;
        
        // Remove the last assistant message (which will be regenerated)
        if (actualIndex < newMessages.length - 1 && newMessages[actualIndex + 1].role === 'assistant') {
          newMessages.splice(actualIndex + 1, 1);
        }
        
        setMessages(newMessages);
      } else {
        // If no user message found (unlikely), just append
        setMessages((prevMessages) => [...prevMessages, userMessage]);
      }
      
      setIsEditing(false);
    } else {
      // Normal flow - append the new message
      setMessages((prevMessages) => [...prevMessages, userMessage]);
    }
    
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
          messages: [...messages, userMessage].filter(msg => msg.role !== 'assistant' || msg.content !== '')
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
  
  const handleEditLastMessage = () => {
    // Find the last user message
    const lastUserMessage = [...messages].reverse().find(msg => msg.role === 'user');
    if (lastUserMessage) {
      setInput(lastUserMessage.content);
      setIsEditing(true);
      
      toast({
        title: 'Editing message',
        description: 'Edit your message and press send to regenerate the response.',
      });
    }
  };
  
  const handleRegenerateResponse = () => {
    // Find the last user message
    const lastUserMessage = [...messages].reverse().find(msg => msg.role === 'user');
    if (lastUserMessage && !loading) {
      // Remove the last assistant message
      setMessages(prevMessages => {
        const newMessages = [...prevMessages];
        if (newMessages[newMessages.length - 1].role === 'assistant') {
          return newMessages.slice(0, -1);
        }
        return newMessages;
      });
      
      // Set the input to the last user message and trigger send
      setInput(lastUserMessage.content);
      
      // Use setTimeout to ensure state updates before sending
      setTimeout(() => {
        handleSend();
      }, 0);
    }
  };

  // Determine if a message is the last user message
  const isLastUserMessage = (index: number) => {
    // Check if this is the last user message in the conversation
    const userMessages = messages.filter(msg => msg.role === 'user');
    return userMessages.length > 0 && messages[index].role === 'user' && 
           index === messages.findIndex(msg => msg === userMessages[userMessages.length - 1]);
  };

  return (
    <div className="container mx-auto py-6">
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold">NexusAI</CardTitle>
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
        </CardHeader>
        
        <CardContent className="p-0 flex flex-col h-[calc(100vh-12rem)]">
          <ScrollArea className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-4">
              {messages
                .filter((message) => message.role !== 'system')
                .map((message, index) => (
                  <ChatMessageComponent 
                    key={index} 
                    message={message} 
                    isLastUserMessage={isLastUserMessage(index)}
                    onEdit={handleEditLastMessage}
                    onRefresh={handleRegenerateResponse}
                  />
                ))}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
          
          <div className="p-4 border-t mt-auto">
            <div className="flex items-center space-x-2">
              <Input
                placeholder={isEditing ? "Edit your message..." : "Type your message..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading || !isConnected}
                className={`flex-1 ${isEditing ? 'border-amber-500' : ''}`}
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
                  variant={isEditing ? "warning" : "default"}
                >
                  {loading ? (
                    <span className="animate-spin">⏳</span>
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
            {isEditing && (
              <p className="text-sm text-amber-500 mt-2">
                Editing message. Press send to regenerate response.
              </p>
            )}
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
        </CardContent>
      </Card>
    </div>
  );
}

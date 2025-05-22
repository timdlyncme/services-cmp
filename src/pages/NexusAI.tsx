import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/components/ui/use-toast';
import { ConfigDialog } from '@/components/nexus-ai/ConfigDialog';
import { DebugLogs } from '@/components/nexus-ai/DebugLogs';
import { ChatMessage as ChatMessageComponent } from '@/components/nexus-ai/ChatMessage';
import { NexusAIService, ChatMessage } from '@/services/nexus-ai-service';
import { useAzureOpenAI } from '@/contexts/AzureOpenAIContext';
import { Send, ChevronDown, ChevronUp, ExternalLink, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';

// Example prompts for users to try
const EXAMPLE_PROMPTS = [
  {
    title: "Template Recommendations",
    prompt: "What templates would you recommend for deploying a three-tier web application?"
  },
  {
    title: "Cloud Cost Optimization",
    prompt: "How can I optimize costs for my AWS cloud resources?"
  },
  {
    title: "Environment Setup",
    prompt: "What's the best way to set up development, staging, and production environments?"
  },
  {
    title: "Security Best Practices",
    prompt: "What are the security best practices for cloud deployments?"
  },
  {
    title: "Multi-Cloud Strategy",
    prompt: "How should I approach a multi-cloud strategy?"
  }
];

export default function NexusAI() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'system',
      content: 'You are NexusAI, an advanced AI assistant designed to support power users in managing and gaining insights from the Cloud Management Platform. Your primary role is to assist users with comprehensive management capabilities, including access to all tenants, cloud resources, templates, deployments, and more. Focus on providing clear, concise, and actionable insights that empower users to navigate and optimize the platform effectively. Always prioritize user needs and context, and ensure your responses enhance their understanding and control over their cloud resources.'
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
  const [statusExpanded, setStatusExpanded] = useState(true);
  const [examplesExpanded, setExamplesExpanded] = useState(true);
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
    connectionChecked,
    config,
    lastCheckedTime
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

  const handleSend = async (promptText = input) => {
    if (!promptText.trim()) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: promptText
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
      addLog(`Sending message: ${promptText}`, 'info');
      
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
  
  // Format the last checked time
  const getLastCheckedText = () => {
    if (!lastCheckedTime) return 'Never checked';
    
    // Format as relative time (e.g., "2 minutes ago")
    const now = new Date();
    const diffMs = now.getTime() - lastCheckedTime.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 10) return 'Just now';
    if (diffSec < 60) return `${diffSec} seconds ago`;
    
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
    
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? '' : 's'} ago`;
    
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
  };
  
  const handleExampleClick = (prompt: string) => {
    setInput(prompt);
    handleSend(prompt);
  };

  return (
    <div className="container mx-auto py-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Chat Area */}
        <Card className="w-full md:col-span-2">
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold">NexusAI</CardTitle>
              <div className="flex items-center space-x-2">
                <ConfigDialog onConfigUpdate={() => testConnection()} />
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
                    onClick={() => handleSend()}
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
        
        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* NexusAI Status */}
          <Collapsible 
            open={statusExpanded} 
            onOpenChange={setStatusExpanded}
            className="border rounded-lg shadow-sm"
          >
            <div className="border-b">
              <CollapsibleTrigger asChild>
                <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-muted/50">
                  <h3 className="text-lg font-semibold">NexusAI Status</h3>
                  {statusExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CollapsibleTrigger>
            </div>
            
            <CollapsibleContent>
              <div className="p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Connection Status:</span>
                  <Badge 
                    variant={
                      connectionStatus === 'connected' 
                        ? 'success' 
                        : connectionStatus === 'connecting' 
                          ? 'warning' 
                          : 'destructive'
                    }
                    className="ml-2"
                  >
                    {connectionStatus === 'connected' 
                      ? 'Connected' 
                      : connectionStatus === 'connecting' 
                        ? 'Connecting...' 
                        : 'Disconnected'
                    }
                  </Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Model:</span>
                  <span className="text-sm">{config.deploymentName || 'Not configured'}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Endpoint:</span>
                  <span className="text-sm truncate max-w-[150px]" title={config.endpoint || 'Not configured'}>
                    {config.endpoint ? new URL(config.endpoint).hostname : 'Not configured'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Last Checked:</span>
                  <span className="text-sm">{getLastCheckedText()}</span>
                </div>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full mt-2" 
                  onClick={() => testConnection()}
                  disabled={!isConfigured || connectionStatus === 'connecting'}
                >
                  <RefreshCw className="h-3 w-3 mr-2" />
                  Check Connection
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
          
          {/* Examples */}
          <Collapsible 
            open={examplesExpanded} 
            onOpenChange={setExamplesExpanded}
            className="border rounded-lg shadow-sm"
          >
            <div className="border-b">
              <CollapsibleTrigger asChild>
                <div className="p-4 flex justify-between items-center cursor-pointer hover:bg-muted/50">
                  <h3 className="text-lg font-semibold">Examples</h3>
                  {examplesExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CollapsibleTrigger>
            </div>
            
            <CollapsibleContent>
              <div className="p-4 space-y-2">
                <p className="text-sm text-muted-foreground mb-4">
                  Click on an example to try it out:
                </p>
                
                {EXAMPLE_PROMPTS.map((example, index) => (
                  <Button 
                    key={index} 
                    variant="ghost" 
                    className="w-full justify-start text-left h-auto py-2 px-3"
                    onClick={() => handleExampleClick(example.prompt)}
                    disabled={loading || !isConnected}
                  >
                    <div>
                      <p className="font-medium">{example.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{example.prompt}</p>
                    </div>
                  </Button>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}

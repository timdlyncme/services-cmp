import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BarChart, 
  FileText, 
  CloudCog, 
  Server, 
  Users, 
  Database, 
  Settings, 
  Send,
  RefreshCw,
  Edit,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { useAzureOpenAI } from "@/contexts/AzureOpenAIContext";
import { AzureOpenAIService } from "@/services/azureOpenAIService";
import ConfigDialog from "@/components/azure-openai/ConfigDialog";
import ConnectionStatus from "@/components/azure-openai/ConnectionStatus";
import DebugLogs from "@/components/azure-openai/DebugLogs";
import { Message, AIInsight } from "@/types/azure-openai";
import { parseMarkdown } from "@/utils/markdown";

// Add CSS for markdown content
import "./NexusAI.css";

// Sample insights for the demo
const sampleInsights: AIInsight[] = [
  {
    id: "insight-1",
    title: "Potential cost optimization in tenant 'Acme Corp'",
    description: "The 'Acme Corp' tenant has 3 unused VM instances that have been idle for over 30 days. Consider shutting them down to save costs.",
    category: "tenant",
    severity: "medium",
    timestamp: "2023-06-10T14:25:00Z"
  },
  {
    id: "insight-2",
    title: "Security vulnerability in 'Network Security' template",
    description: "The 'Network Security' template has overly permissive inbound rules that may expose services to the internet. Consider restricting access to specific IP ranges.",
    category: "template",
    severity: "high",
    timestamp: "2023-06-12T09:15:00Z"
  },
  {
    id: "insight-3",
    title: "Deployment failure trend detected",
    description: "There's an increase in deployment failures for the 'Database Cluster' template across multiple tenants. This might indicate an issue with the template configuration.",
    category: "deployment",
    severity: "medium",
    timestamp: "2023-06-11T16:40:00Z"
  },
  {
    id: "insight-4",
    title: "Resources approaching quota limits",
    description: "The 'Dev Team' tenant is approaching its quota for storage accounts. Consider increasing the quota or cleaning up unused resources.",
    category: "tenant",
    severity: "low",
    timestamp: "2023-06-13T10:30:00Z"
  },
  {
    id: "insight-5",
    title: "Unpatched resources detected",
    description: "Multiple VMs across tenants are running outdated OS versions with known security vulnerabilities. Schedule updates to apply security patches.",
    category: "security",
    severity: "high",
    timestamp: "2023-06-09T11:20:00Z"
  }
];

// Sample conversation history
const initialMessages: Message[] = [
  {
    id: "msg-1",
    sender: "ai",
    content: "Hello! I'm NexusAI, your platform assistant. I can help you with information about your tenants, deployments, templates, and platform health. How can I assist you today?",
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString()
  }
];

const NexusAI = () => {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [messageInput, setMessageInput] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [insights] = useState<AIInsight[]>(sampleInsights);
  const [isLoading, setIsLoading] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { config, isConfigured, isConnected, connectionStatus, testConnection, addLog } = useAzureOpenAI();

  // Only scroll to bottom if user hasn't scrolled up manually
  useEffect(() => {
    if (!userScrolled && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, userScrolled]);

  // If configured, test the connection on component mount
  useEffect(() => {
    if (isConfigured && connectionStatus === "disconnected") {
      testConnection();
    }
  }, [isConfigured, connectionStatus, testConnection]);

  const scrollToBottom = () => {
    if (messagesEndRef.current && chatContainerRef.current) {
      // Get the scroll container (the viewport of the ScrollArea)
      const scrollContainer = chatContainerRef.current.querySelector('[data-radix-scroll-area-viewport]');
      
      if (scrollContainer) {
        // Calculate the position to scroll to (bottom of the messages)
        const scrollPosition = messagesEndRef.current.offsetTop;
        
        // Scroll the chat container instead of the entire page
        scrollContainer.scrollTo({
          top: scrollPosition,
          behavior: 'smooth'
        });
      }
    }
  };

  // Handle scroll events to detect when user scrolls up
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
    setUserScrolled(!isAtBottom);
  };

  const handleSendMessage = async (content?: string) => {
    const messageToSend = content || messageInput;
    if (!messageToSend.trim()) return;
    
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      sender: "user",
      content: messageToSend.trim(),
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => {
      // If we're editing a message, replace it and all subsequent messages
      if (editingMessageId) {
        const editIndex = prev.findIndex(msg => msg.id === editingMessageId);
        if (editIndex >= 0) {
          return [...prev.slice(0, editIndex), userMessage];
        }
      }
      return [...prev, userMessage];
    });
    
    setMessageInput("");
    setEditingMessageId(null);
    setIsLoading(true);
    setUserScrolled(false); // Reset user scrolled state when sending a new message
    
    try {
      if (isConfigured && isConnected) {
        // Use Azure OpenAI service
        const azureOpenAIService = new AzureOpenAIService(config, (message, level, details) => {
          // This callback will be called with log messages from the service
          addLog(message, level, details);
          console.log(message, details);
        });
        
        // Get the messages to include in the API request
        let messagesToSend;
        if (editingMessageId) {
          // If editing, get all messages up to and including the edited message
          const editIndex = messages.findIndex(msg => msg.id === editingMessageId);
          messagesToSend = editIndex >= 0 ? messages.slice(0, editIndex) : messages;
        } else {
          messagesToSend = messages;
        }
        
        // Convert our messages to the format expected by the API
        const apiMessages = messagesToSend.concat(userMessage).map(msg => ({
          role: msg.sender === "user" ? "user" : "assistant",
          content: msg.content
        }));
        
        // Add a system message at the beginning
        apiMessages.unshift({
          role: "system",
          content: "You are NexusAI, a helpful assistant for the cloud management platform. You help users with information about their tenants, deployments, templates, and platform health."
        });
        
        // Create a placeholder message for streaming
        const aiMessageId = `msg-${Date.now()}`;
        const aiMessage: Message = {
          id: aiMessageId,
          sender: "ai",
          content: "",
          timestamp: new Date().toISOString(),
          isStreaming: true
        };
        
        setMessages(prevMessages => [...prevMessages, aiMessage]);
        
        // Send the request to Azure OpenAI with streaming enabled
        await azureOpenAIService.sendChatCompletion(
          apiMessages,
          {
            stream: true,
            onChunk: (chunk) => {
              setMessages(prevMessages => {
                const lastMessage = prevMessages[prevMessages.length - 1];
                if (lastMessage.id === aiMessageId) {
                  const updatedContent = lastMessage.content + chunk;
                  return [
                    ...prevMessages.slice(0, -1),
                    {
                      ...lastMessage,
                      content: updatedContent,
                      formattedContent: parseMarkdown(updatedContent)
                    }
                  ];
                }
                return prevMessages;
              });
            }
          }
        ).then(fullResponse => {
          // Update the message with the complete response and format it
          setMessages(prevMessages => {
            const lastMessage = prevMessages[prevMessages.length - 1];
            if (lastMessage.id === aiMessageId) {
              return [
                ...prevMessages.slice(0, -1),
                {
                  ...lastMessage,
                  content: fullResponse,
                  formattedContent: parseMarkdown(fullResponse),
                  isStreaming: false
                }
              ];
            }
            return prevMessages;
          });
        });
      } else {
        // Fallback to sample responses if not configured or connected
        setTimeout(() => {
          const aiResponses = [
            "Based on my analysis of your platform, I see that you currently have 3 active tenants with a total of 42 deployments. The 'Acme Corp' tenant has the most resources provisioned.\n\n**Key Statistics:**\n- 3 Active Tenants\n- 42 Total Deployments\n- 17 Templates\n- 98.2% Platform Health\n\nWould you like more detailed information about any specific tenant or deployment?",
            "I've analyzed your deployment patterns and noticed that the 'Database Cluster' template has a 23% failure rate across tenants. The most common error is related to network configuration. Would you like me to suggest some optimization strategies?",
            "Looking at your cloud spend, I've identified potential savings of approximately 15% by rightsizing underutilized resources and implementing auto-scaling for the 'Web Application' deployments. Would you like a detailed breakdown of these recommendations?",
            "I've detected 3 security vulnerabilities in your deployed resources. The most critical one affects the 'Network Security' template which has overly permissive inbound rules. I recommend restricting access to specific IP ranges to mitigate this risk.",
            "The 'Dev Team' tenant is approaching its quota for storage accounts. Based on current usage patterns, you'll reach the limit in approximately 14 days. Consider increasing the quota or implementing a cleanup policy for unused storage resources."
          ];
          
          const randomResponse = aiResponses[Math.floor(Math.random() * aiResponses.length)];
          
          const aiMessage: Message = {
            id: `msg-${Date.now()}`,
            sender: "ai",
            content: randomResponse,
            formattedContent: parseMarkdown(randomResponse),
            timestamp: new Date().toISOString()
          };
          
          setMessages(prev => [...prev, aiMessage]);
        }, 1500);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message. Please try again.");
      
      // Add error message
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
      const aiMessage: Message = {
        id: `msg-${Date.now()}`,
        sender: "ai",
        content: `I'm sorry, I encountered an error: ${errorMessage}. Please try again or check your connection settings.`,
        formattedContent: parseMarkdown(`I'm sorry, I encountered an error: ${errorMessage}. Please try again or check your connection settings.`),
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, aiMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleEditMessage = (messageId: string) => {
    const message = messages.find(msg => msg.id === messageId);
    if (message && message.sender === "user") {
      setEditingMessageId(messageId);
      setMessageInput(message.content);
    }
  };

  const handleRetry = () => {
    if (messages.length < 2) return;
    
    setIsRetrying(true);
    
    // Find the last user message
    const lastUserMessageIndex = [...messages].reverse().findIndex(msg => msg.sender === "user");
    
    if (lastUserMessageIndex >= 0) {
      const lastUserMessage = messages[messages.length - 1 - lastUserMessageIndex];
      
      // Remove all messages after the last user message
      setMessages(messages.slice(0, messages.length - lastUserMessageIndex));
      
      // Re-send the last user message
      setTimeout(() => {
        handleSendMessage(lastUserMessage.content);
        setIsRetrying(false);
      }, 500);
    } else {
      setIsRetrying(false);
    }
  };

  const handleAskAboutInsight = (insight: AIInsight) => {
    const prompt = `Tell me more about this insight: "${insight.title}" - ${insight.description}`;
    handleSendMessage(prompt);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "deployment":
        return <Server className="h-4 w-4" />;
      case "tenant":
        return <Users className="h-4 w-4" />;
      case "template":
        return <FileText className="h-4 w-4" />;
      case "security":
        return <Settings className="h-4 w-4" />;
      default:
        return <Database className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "low":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default:
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header with Configure Button and Connection Status */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">NexusAI Assistant</h1>
        <div className="flex items-center gap-4">
          <ConnectionStatus />
          <ConfigDialog />
        </div>
      </div>
      
      {/* Debug Logs */}
      <DebugLogs />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center">
                <CloudCog className="h-5 w-5 mr-2" />
                AI Chat
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
              <ScrollArea 
                className="flex-1 px-4" 
                ref={chatContainerRef}
                onScroll={handleScroll}
              >
                <div className="space-y-4 pb-4">
                  {messages.map((message, index) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-lg p-4 ${
                          message.sender === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        {message.sender === "user" ? (
                          <div className="flex items-start justify-between">
                            <div>{message.content}</div>
                            {!isLoading && !editingMessageId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 ml-2 -mr-2 -mt-2 text-primary-foreground/70 hover:text-primary-foreground"
                                onClick={() => handleEditMessage(message.id)}
                              >
                                <Edit className="h-3 w-3" />
                                <span className="sr-only">Edit</span>
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div>
                            {message.formattedContent ? (
                              <div 
                                className="markdown-content"
                                dangerouslySetInnerHTML={{ __html: message.formattedContent }}
                              />
                            ) : (
                              <div className="markdown-content">{message.content}</div>
                            )}
                            {message.isStreaming && (
                              <span className="cursor-blink" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              <div className="p-4 border-t">
                <div className="flex gap-2">
                  <Input
                    placeholder={
                      editingMessageId
                        ? "Edit your message..."
                        : "Type your message..."
                    }
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button
                    onClick={() => handleSendMessage()}
                    disabled={isLoading || !messageInput.trim()}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    <span className="sr-only">Send</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleRetry}
                    disabled={isLoading || isRetrying || messages.length < 2}
                    title="Retry last message"
                  >
                    {isRetrying ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="sr-only">Retry</span>
                  </Button>
                </div>
                {!isConfigured && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Azure OpenAI is not configured. Click the Configure button to set up the integration.
                  </p>
                )}
                {isConfigured && !isConnected && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Not connected to Azure OpenAI. Check your configuration and connection status.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-6">
          <Card className="h-[600px] flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center">
                <BarChart className="h-5 w-5 mr-2" />
                AI Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
              <Tabs defaultValue="all" className="flex flex-col h-full">
                <TabsList className="mx-4 mt-2 grid grid-cols-5">
                  <TabsTrigger value="all" className="flex-1 text-xs">All</TabsTrigger>
                  <TabsTrigger value="tenant" className="flex-1 text-xs">Tenant</TabsTrigger>
                  <TabsTrigger value="template" className="flex-1 text-xs">Template</TabsTrigger>
                  <TabsTrigger value="deployment" className="flex-1 text-xs">Deploy</TabsTrigger>
                  <TabsTrigger value="security" className="flex-1 text-xs">Security</TabsTrigger>
                </TabsList>
                
                <TabsContent value="all" className="mt-4 flex-1 overflow-hidden px-6">
                  <ScrollArea className="h-full pr-4">
                    <div className="space-y-4 pb-4">
                      {insights.map((insight) => (
                        <Card key={insight.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                          <CardContent className="p-4 space-y-2" onClick={() => handleAskAboutInsight(insight)}>
                            <div className="flex justify-between items-start">
                              <div className="flex items-center gap-2">
                                {getCategoryIcon(insight.category)}
                                <span className="font-medium">{insight.title}</span>
                              </div>
                              <div className={`text-xs px-2 py-1 rounded-full ${getSeverityColor(insight.severity)}`}>
                                {insight.severity}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground">{insight.description}</p>
                            <div className="text-xs text-muted-foreground">
                              {new Date(insight.timestamp).toLocaleDateString()}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="tenant" className="mt-4 flex-1 overflow-hidden px-6">
                  <ScrollArea className="h-full pr-4">
                    <div className="space-y-4 pb-4">
                      {insights
                        .filter((insight) => insight.category === "tenant")
                        .map((insight) => (
                          <Card key={insight.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                            <CardContent className="p-4 space-y-2" onClick={() => handleAskAboutInsight(insight)}>
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                  <Users className="h-4 w-4" />
                                  <span className="font-medium">{insight.title}</span>
                                </div>
                                <div className={`text-xs px-2 py-1 rounded-full ${getSeverityColor(insight.severity)}`}>
                                  {insight.severity}
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground">{insight.description}</p>
                              <div className="text-xs text-muted-foreground">
                                {new Date(insight.timestamp).toLocaleDateString()}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="template" className="mt-4 flex-1 overflow-hidden px-6">
                  <ScrollArea className="h-full pr-4">
                    <div className="space-y-4 pb-4">
                      {insights
                        .filter((insight) => insight.category === "template")
                        .map((insight) => (
                          <Card key={insight.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                            <CardContent className="p-4 space-y-2" onClick={() => handleAskAboutInsight(insight)}>
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4" />
                                  <span className="font-medium">{insight.title}</span>
                                </div>
                                <div className={`text-xs px-2 py-1 rounded-full ${getSeverityColor(insight.severity)}`}>
                                  {insight.severity}
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground">{insight.description}</p>
                              <div className="text-xs text-muted-foreground">
                                {new Date(insight.timestamp).toLocaleDateString()}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="deployment" className="mt-4 flex-1 overflow-hidden px-6">
                  <ScrollArea className="h-full pr-4">
                    <div className="space-y-4 pb-4">
                      {insights
                        .filter((insight) => insight.category === "deployment")
                        .map((insight) => (
                          <Card key={insight.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                            <CardContent className="p-4 space-y-2" onClick={() => handleAskAboutInsight(insight)}>
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                  <Server className="h-4 w-4" />
                                  <span className="font-medium">{insight.title}</span>
                                </div>
                                <div className={`text-xs px-2 py-1 rounded-full ${getSeverityColor(insight.severity)}`}>
                                  {insight.severity}
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground">{insight.description}</p>
                              <div className="text-xs text-muted-foreground">
                                {new Date(insight.timestamp).toLocaleDateString()}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
                
                <TabsContent value="security" className="mt-4 flex-1 overflow-hidden px-6">
                  <ScrollArea className="h-full pr-4">
                    <div className="space-y-4 pb-4">
                      {insights
                        .filter((insight) => insight.category === "security")
                        .map((insight) => (
                          <Card key={insight.id} className="cursor-pointer hover:bg-accent/50 transition-colors">
                            <CardContent className="p-4 space-y-2" onClick={() => handleAskAboutInsight(insight)}>
                              <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2">
                                  <Settings className="h-4 w-4" />
                                  <span className="font-medium">{insight.title}</span>
                                </div>
                                <div className={`text-xs px-2 py-1 rounded-full ${getSeverityColor(insight.severity)}`}>
                                  {insight.severity}
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground">{insight.description}</p>
                              <div className="text-xs text-muted-foreground">
                                {new Date(insight.timestamp).toLocaleDateString()}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center">
            <BarChart className="h-5 w-5 mr-2" />
            Platform Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">3</div>
                <p className="text-xs text-muted-foreground">Active Tenants</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">42</div>
                <p className="text-xs text-muted-foreground">Total Deployments</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">17</div>
                <p className="text-xs text-muted-foreground">Templates</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">98.2%</div>
                <p className="text-xs text-muted-foreground">Platform Health</p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NexusAI;

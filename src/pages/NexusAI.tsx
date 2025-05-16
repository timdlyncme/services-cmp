import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, FileText, CloudCog, Server, Users, Database, Settings, Send } from "lucide-react";
import { toast } from "sonner";
import { useAzureOpenAI } from "@/contexts/AzureOpenAIContext";
import { AzureOpenAIService } from "@/services/azureOpenAIService";
import ConfigDialog from "@/components/azure-openai/ConfigDialog";
import ConnectionStatus from "@/components/azure-openai/ConnectionStatus";
import DebugLogs from "@/components/azure-openai/DebugLogs";
import { Message, AIInsight } from "@/types/azure-openai";

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
  const [insights] = useState<AIInsight[]>(sampleInsights);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { config, isConfigured, isConnected, connectionStatus, testConnection } = useAzureOpenAI();

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // If configured, test the connection on component mount
  useEffect(() => {
    if (isConfigured && connectionStatus === "disconnected") {
      testConnection();
    }
  }, [isConfigured, connectionStatus, testConnection]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async () => {
    if (!messageInput.trim()) return;
    
    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      sender: "user",
      content: messageInput.trim(),
      timestamp: new Date().toISOString()
    };
    
    setMessages([...messages, userMessage]);
    setMessageInput("");
    setIsLoading(true);
    
    try {
      if (isConfigured && isConnected) {
        // Use Azure OpenAI service
        const azureOpenAIService = new AzureOpenAIService(config, (log) => {
          // This callback will be called with log messages from the service
          console.log(log);
        });
        
        // Convert our messages to the format expected by the API
        const apiMessages = messages.concat(userMessage).map(msg => ({
          role: msg.sender === "user" ? "user" : "assistant",
          content: msg.content
        }));
        
        // Add a system message at the beginning
        apiMessages.unshift({
          role: "system",
          content: "You are NexusAI, a helpful assistant for the cloud management platform. You help users with information about their tenants, deployments, templates, and platform health."
        });
        
        // Send the request to Azure OpenAI
        const response = await azureOpenAIService.sendChatCompletion(apiMessages);
        
        const aiMessage: Message = {
          id: `msg-${Date.now()}`,
          sender: "ai",
          content: response,
          timestamp: new Date().toISOString()
        };
        
        setMessages(prevMessages => [...prevMessages, aiMessage]);
      } else {
        // Fallback to sample responses if not configured or connected
        setTimeout(() => {
          const aiResponses = [
            "Based on my analysis of your platform, I see that you currently have 3 active tenants with a total of 42 deployments. The 'Acme Corp' tenant has the most resources provisioned.",
            "I've analyzed your templates and found that the 'Network Security Group' template could be optimized for better security. Would you like me to suggest specific improvements?",
            "Looking at your recent deployments, I noticed an increase in failure rate for database deployments. The most common error is related to networking configuration.",
            "I can see that tenant 'Dev Team' has been particularly active today with 5 new deployments. All deployments are healthy and running without issues.",
            "Based on current usage patterns, I predict that you'll need to increase resource quotas for 'Cloud Ops' tenant within the next 30 days to accommodate their growth."
          ];
          
          const randomResponse = aiResponses[Math.floor(Math.random() * aiResponses.length)];
          
          const aiMessage: Message = {
            id: `msg-${Date.now()}`,
            sender: "ai",
            content: randomResponse,
            timestamp: new Date().toISOString()
          };
          
          setMessages(prevMessages => [...prevMessages, aiMessage]);
          setIsLoading(false);
        }, 1500);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Error: ${errorMessage}`);
      
      const aiMessage: Message = {
        id: `msg-${Date.now()}`,
        sender: "ai",
        content: `I'm sorry, I encountered an error while processing your request. ${errorMessage}`,
        timestamp: new Date().toISOString()
      };
      
      setMessages(prevMessages => [...prevMessages, aiMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high": return "bg-red-100 text-red-800";
      case "medium": return "bg-amber-100 text-amber-800";
      case "low": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "deployment": return <Server className="h-4 w-4" />;
      case "tenant": return <Users className="h-4 w-4" />;
      case "template": return <FileText className="h-4 w-4" />;
      case "security": return <Settings className="h-4 w-4" />;
      default: return <Database className="h-4 w-4" />;
    }
  };

  const handleAskAboutInsight = (insight: AIInsight) => {
    const question = `Tell me more about the insight: "${insight.title}"`;
    setMessageInput(question);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">NexusAI Assistant</h1>
          <p className="text-muted-foreground">
            Your intelligent assistant for platform management and insights
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ConnectionStatus />
          <ConfigDialog />
        </div>
      </div>
      
      <DebugLogs />
      
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center">
                <CloudCog className="h-5 w-5 mr-2 text-primary" />
                NexusAI Chat
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <ScrollArea className="flex-1 pr-4 min-h-[500px]">
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.sender === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] p-3 rounded-lg ${
                          message.sender === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <p className="break-words">{message.content}</p>
                        <p className="text-xs mt-1 opacity-70">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="max-w-[80%] p-3 rounded-lg bg-muted">
                        <div className="flex space-x-2">
                          <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                          <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                          <div className="h-2 w-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
              <div className="mt-4 flex gap-2">
                <Input
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Ask NexusAI about your platform..."
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button onClick={handleSendMessage} disabled={!messageInput.trim() || isLoading}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle>AI Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="all">
                <TabsList className="grid grid-cols-5 w-full">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="tenant">Tenants</TabsTrigger>
                  <TabsTrigger value="template">Templates</TabsTrigger>
                  <TabsTrigger value="deployment">Deploy</TabsTrigger>
                  <TabsTrigger value="security">Security</TabsTrigger>
                </TabsList>
                
                <TabsContent value="all" className="mt-4 space-y-4">
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
                </TabsContent>
                
                <TabsContent value="tenant" className="mt-4 space-y-4">
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
                </TabsContent>
                
                <TabsContent value="template" className="mt-4 space-y-4">
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
                </TabsContent>
                
                <TabsContent value="deployment" className="mt-4 space-y-4">
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
                </TabsContent>
                
                <TabsContent value="security" className="mt-4 space-y-4">
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

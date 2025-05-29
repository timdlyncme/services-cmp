import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CloudTemplate, TemplateParameter, TemplateVariable } from "@/types/cloud";
import { ChevronLeft, Save, Play, MessagesSquare, History, FileEdit, Plus, Trash2, ChevronDown, ChevronUp, Eye, EyeOff, Loader2, Maximize2, Minimize2 } from "lucide-react";
import { toast } from "sonner";
import { cmpService } from "@/services/cmp-service";
import { deploymentService } from "@/services/deployment-service";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useAzureOpenAI } from "@/contexts/AzureOpenAIContext";
import { AzureOpenAIService, ChatMessage as AIChatMessage } from "@/services/azureOpenAIService";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AIAssistantService } from "@/services/ai-assistant-service";

interface TemplateVersion {
  id: number;
  version: string;
  changes: string;
  created_at: string;
  created_by: string;
  is_current: boolean;
}

interface Environment {
  id: string;
  name: string;
  description: string;
  provider: string;
  tenantId: string;
  internal_id: number; // Add internal_id to the environment
}

const TemplateDetails = () => {
  const { templateId } = useParams();
  const { currentTenant } = useAuth();
  const navigate = useNavigate();
  
  // All state declarations grouped together
  const [template, setTemplate] = useState<CloudTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loadingEnvironments, setLoadingEnvironments] = useState(false);
  const [parameters, setParameters] = useState<TemplateParameter[]>([]);
  const [variables, setVariables] = useState<TemplateVariable[]>([]);
  const [code, setCode] = useState("");
  const [activeTab, setActiveTab] = useState("code");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);
  const [versionNotes, setVersionNotes] = useState("");
  const [isVersionDialogOpen, setIsVersionDialogOpen] = useState(false);
  const [selectedEnvironment, setSelectedEnvironment] = useState<Environment | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentName, setDeploymentName] = useState("");
  const [isDeployDialogOpen, setIsDeployDialogOpen] = useState(false);
  const [deploymentParameters, setDeploymentParameters] = useState<Record<string, string>>({});
  const [deploymentVariables, setDeploymentVariables] = useState<Record<string, string>>({});
  
  // AI Assistant state
  const [aiChatMessages, setAiChatMessages] = useState<AIChatMessage[]>([
    { role: "system", content: "You are an AI assistant that helps with understanding and modifying cloud templates. You have knowledge about Azure, AWS, and GCP resources and infrastructure as code." },
    { role: "assistant", content: "Hello! I can help you understand and modify this template. What would you like to know?" }
  ]);
  const [aiMessage, setAiMessage] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);
  const [azureOpenAISettings, setAzureOpenAISettings] = useState({
    enabled: false,
    endpoint: "",
    apiKey: "",
    deploymentName: "",
    model: "gpt-4",
    apiVersion: "2023-05-15"
  });
  
  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  // Hooks
  const { isConfigured, config } = useAzureOpenAI();
  
  // Services
  const aiAssistantService = new AIAssistantService();
  
  // Functions
  const fetchVersions = async (templateId: string) => {
    try {
      setLoadingVersions(true);
      const response = await fetch(`http://localhost:8000/api/templates/${templateId}/versions`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setVersions(data);
      } else {
        console.error("Failed to fetch template versions");
      }
    } catch (err) {
      console.error("Error fetching template versions:", err);
    } finally {
      setLoadingVersions(false);
    }
  };
  
  const fetchEnvironments = async () => {
    try {
      setLoadingEnvironments(true);
      const response = await fetch(`http://localhost:8000/api/environments/?tenant_id=${currentTenant?.tenant_id || ''}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setEnvironments(data);
        
        // Set default environment if available
        if (data.length > 0) {
          setSelectedEnvironment(data[0]);
        }
      } else {
        console.error("Failed to fetch environments");
        toast.error("Failed to load environments");
      }
    } catch (err) {
      console.error("Error fetching environments:", err);
      toast.error("Error loading environments");
    } finally {
      setLoadingEnvironments(false);
    }
  };
  
  // Load Azure OpenAI settings
  const loadAzureOpenAISettings = async () => {
    try {
      const config = await aiAssistantService.getConfig();
      
      setAzureOpenAISettings({
        enabled: Boolean(config.api_key && config.endpoint && config.deployment_name),
        endpoint: config.endpoint || "",
        apiKey: config.api_key === "********" ? "" : (config.api_key || ""),
        deploymentName: config.deployment_name || "",
        model: config.model || "gpt-4",
        apiVersion: config.api_version || "2023-05-15"
      });
    } catch (error) {
      console.error("Error loading Azure OpenAI settings:", error);
      // Don't show a toast error here, as this might be the first time the user is setting up Azure OpenAI
    }
  };
  
  // Handle sending message to AI
  const handleAiSend = async () => {
    if (!aiMessage.trim()) return;
    
    // Add user message to chat
    const userMessage: AIChatMessage = { role: "user", content: aiMessage };
    setAiChatMessages(prev => [...prev, userMessage]);
    setAiMessage("");
    setIsAiLoading(true);
    
    try {
      // Prepare template data for context
      const templateData = template ? {
        id: template.id,
        name: template.name,
        description: template.description,
        type: template.type,
        provider: template.provider,
        code: template.code,
        parameters: parameters,
        variables: variables
      } : null;
      
      // Use streaming API for better user experience
      const abortController = aiAssistantService.streamChat(
        {
          messages: [...aiChatMessages.filter(msg => msg.role !== "system"), userMessage],
          template_data: templateData,
          temperature: 0.7
        },
        (content) => {
          // Update the streaming message
          setAiChatMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            
            // If the last message is from the assistant and is streaming, update it
            if (lastMessage && lastMessage.role === "assistant") {
              newMessages[newMessages.length - 1] = {
                ...lastMessage,
                content: lastMessage.content + content
              };
            } else {
              // Otherwise, add a new message
              newMessages.push({
                role: "assistant",
                content: content
              });
            }
            
            return newMessages;
          });
        },
        (error) => {
          console.error("Error in AI streaming:", error);
          toast.error("Error getting AI response");
          
          // Add error message to chat
          setAiChatMessages(prev => [...prev, { 
            role: "assistant", 
            content: "I'm sorry, I encountered an error while processing your request. Please try again later." 
          }]);
          
          setIsAiLoading(false);
        },
        () => {
          // Streaming completed
          setIsAiLoading(false);
        }
      );
      
      // Store the abort controller for cleanup
      return () => {
        if (abortController) {
          abortController();
        }
      };
    } catch (error) {
      console.error("Error getting AI response:", error);
      toast.error("Failed to get AI response");
      
      // Add error message to chat
      setAiChatMessages(prev => [...prev, { 
        role: "assistant", 
        content: "I'm sorry, I encountered an error while processing your request. Please try again later." 
      }]);
      
      setIsAiLoading(false);
    }
  };
  
  // Effect to fetch template data when ID changes
  useEffect(() => {
    const fetchTemplate = async () => {
      if (!templateId) {
        setError("No template ID provided");
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const templateData = await cmpService.getTemplate(templateId);
        
        if (templateData) {
          setTemplate(templateData);
          setCode(templateData.code || "");
          
          // Initialize parameters and variables from template data
          if (templateData.parameters) {
            console.log("Loading parameters from template:", templateData.parameters);
            setParameters(templateData.parameters);
          } else {
            console.log("No parameters found in template data");
            setParameters([]);
          }
          
          if (templateData.variables) {
            console.log("Loading variables from template:", templateData.variables);
            setVariables(templateData.variables);
          } else {
            console.log("No variables found in template data");
            setVariables([]);
          }
          
          // Fetch template versions
          await fetchVersions(templateId);
          
          // Fetch environments
          await fetchEnvironments();
          
          // Set default deployment name
          if (templateData.name) {
            setDeploymentName(`${templateData.name}-deployment`);
          }
        } else {
          setError("Template not found");
        }
      } catch (err) {
        console.error("Error fetching template:", err);
        setError("Failed to load template details");
      } finally {
        setLoading(false);
      }
    };
    
    fetchTemplate();
  }, [templateId]);
  
  // Load Azure OpenAI settings when component mounts
  useEffect(() => {
    loadAzureOpenAISettings();
  }, []);
  
  // Scroll to bottom of chat when messages change
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [aiChatMessages]);
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Loading template...</h2>
        </div>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold">Template not found</h2>
          <p className="text-muted-foreground">{error || "The requested template does not exist"}</p>
          <Button 
            variant="outline" 
            className="mt-4"
            onClick={() => navigate("/catalog")}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Back to Catalog
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to Templates
        </Button>
        <div className="space-x-2">
          <Button style={{ backgroundColor: "darkorange" }} onClick={() => setIsDeployDialogOpen(true)}>
            <Play className="mr-2 h-4 w-4" />
            Deploy Template
          </Button>
        </div>
      </div>
      
      {/* Add back the Dialog component for deployment */}
      <Dialog open={isDeployDialogOpen} onOpenChange={setIsDeployDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deploy Template</DialogTitle>
            <DialogDescription>
              Configure deployment settings for this template.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="deploymentName">Deployment Name</Label>
              <Input 
                id="deploymentName" 
                value={deploymentName} 
                onChange={(e) => setDeploymentName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="environment">Environment</Label>
              <Select 
                value={selectedEnvironment?.id} 
                onValueChange={(value) => setSelectedEnvironment(environments.find(env => env.id === value))}
                disabled={isDeploying}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an environment" />
                </SelectTrigger>
                <SelectContent>
                  {environments.map((env) => (
                    <SelectItem key={env.id} value={env.id}>
                      {env.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Parameters section */}
            {Object.keys(parameters).length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Parameters</h3>
                <div className="space-y-2">
                  {Object.entries(parameters).map(([key, param]) => (
                    <div key={key} className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-3">
                        <Label>Name</Label>
                        <Input 
                          value={key}
                          disabled={true}
                        />
                      </div>
                      <div className="col-span-3">
                        <Label>Type</Label>
                        <Input
                          value={param.type}
                          disabled={true}
                        />
                      </div>
                      <div className="col-span-6">
                        <Label>Value</Label>
                        {param.type === "password" ? (
                          <div className="relative">
                            <Input 
                              type={showPasswordValues[key] ? "text" : "password"}
                              value={param.value}
                              onChange={(e) => updateParameter(key, "value", e.target.value)}
                              className="pr-8"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-0 top-0 h-full"
                              onClick={() => togglePasswordVisibility(key)}
                            >
                              {showPasswordValues[key] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        ) : (
                          <Input 
                            type={param.type === "int" ? "number" : "text"}
                            value={param.value}
                            onChange={(e) => updateParameter(key, "value", e.target.value)}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeployDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleDeployTemplate}>
              {isDeploying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Deploy
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Collapsible open={activeTab === "code"} onOpenChange={setActiveTab}>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center">
                    <FileEdit className="mr-2 h-5 w-5" />
                    Template Code
                  </CardTitle>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      {activeTab === "code" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                  <div className="space-y-4">
                    <div className="relative">
                      <Textarea
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        className="font-mono h-[400px] resize-none"
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button onClick={handleSaveCodeWithNewVersion}>
                        <Save className="mr-2 h-4 w-4" />
                        Create New Version
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
          
          <Collapsible open={activeTab === "params"} onOpenChange={setActiveTab}>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center">
                    <FileEdit className="mr-2 h-5 w-5" />
                    Parameters & Variables
                  </CardTitle>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm">
                      {activeTab === "params" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                  <div className="space-y-6">
                    {/* Parameters section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">Parameters</h3>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={addParameter}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Parameter
                        </Button>
                      </div>
                      
                      {Object.keys(parameters).length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          No parameters defined. Click "Add Parameter" to create one.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {Object.entries(parameters).map(([key, param]) => (
                            <div key={key} className="grid grid-cols-12 gap-2 items-start">
                              <div className="col-span-3">
                                <Label>Name</Label>
                                <Input 
                                  value={key}
                                  onChange={(e) => renameParameter(key, e.target.value)}
                                />
                              </div>
                              <div className="col-span-3">
                                <Label>Type</Label>
                                <Select 
                                  value={param.type} 
                                  onValueChange={(value) => updateParameter(key, "type", value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="string">String</SelectItem>
                                    <SelectItem value="int">Integer</SelectItem>
                                    <SelectItem value="password">Password</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-4">
                                <Label>Value</Label>
                                {param.type === "password" ? (
                                  <div className="relative">
                                    <Input 
                                      type={showPasswordValues[key] ? "text" : "password"}
                                      value={param.value}
                                      onChange={(e) => updateParameter(key, "value", e.target.value)}
                                      className="pr-8"
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="absolute right-0 top-0 h-full"
                                      onClick={() => togglePasswordVisibility(key)}
                                    >
                                      {showPasswordValues[key] ? (
                                        <EyeOff className="h-4 w-4" />
                                      ) : (
                                        <Eye className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                ) : (
                                  <Input 
                                    type={param.type === "int" ? "number" : "text"}
                                    value={param.value}
                                    onChange={(e) => updateParameter(key, "value", e.target.value)}
                                  />
                                )}
                              </div>
                              <div className="col-span-1 pt-6">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeParameter(key)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Variables section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">Variables</h3>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={addVariable}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Variable
                        </Button>
                      </div>
                      
                      {Object.keys(variables).length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          No variables defined. Click "Add Variable" to create one.
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {Object.entries(variables).map(([key, variable]) => (
                            <div key={key} className="grid grid-cols-12 gap-2 items-start">
                              <div className="col-span-3">
                                <Label>Name</Label>
                                <Input 
                                  value={key}
                                  onChange={(e) => renameVariable(key, e.target.value)}
                                />
                              </div>
                              <div className="col-span-3">
                                <Label>Type</Label>
                                <Select 
                                  value={variable.type} 
                                  onValueChange={(value) => updateVariable(key, "type", value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="string">String</SelectItem>
                                    <SelectItem value="int">Integer</SelectItem>
                                    <SelectItem value="password">Password</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-4">
                                <Label>Value</Label>
                                {variable.type === "password" ? (
                                  <div className="relative">
                                    <Input 
                                      type={showPasswordValues[key] ? "text" : "password"}
                                      value={variable.value}
                                      onChange={(e) => updateVariable(key, "value", e.target.value)}
                                      className="pr-8"
                                    />
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="absolute right-0 top-0 h-full"
                                      onClick={() => togglePasswordVisibility(key)}
                                    >
                                      {showPasswordValues[key] ? (
                                        <EyeOff className="h-4 w-4" />
                                      ) : (
                                        <Eye className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                ) : (
                                  <Input 
                                    type={variable.type === "int" ? "number" : "text"}
                                    value={variable.value}
                                    onChange={(e) => updateVariable(key, "value", e.target.value)}
                                  />
                                )}
                              </div>
                              <div className="col-span-1 pt-6">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeVariable(key)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* At the end of the parameters and variables section, add a save button */}
                    <div className="flex justify-end">
                      <Button onClick={handleSaveParamsAndVariables}>
                        <Save className="mr-2 h-4 w-4" />
                        Save Parameters & Variables
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </div>
        
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Template Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Provider</p>
                  <p className="font-medium">{template.provider.toUpperCase()}</p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Type</p>
                  <p className="font-medium">
                    {template.type === "terraform" ? "Terraform" : 
                     template.type === "arm" ? "ARM Template" : "CloudFormation"}
                  </p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Deployments</p>
                  <p className="font-medium">{template.deploymentCount}</p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">
                    {new Date(template.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p className="font-medium">
                    {new Date(template.updatedAt).toLocaleDateString()}
                  </p>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Last Updated By</p>
                  <p className="font-medium">
                    {template.lastUpdatedBy || "Unknown"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className={`${aiExpanded ? "fixed inset-4 z-50 overflow-hidden flex flex-col" : ""}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <MessagesSquare className="mr-2 h-5 w-5" />
                  AI Assistant
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setAiExpanded(!aiExpanded)}
                >
                  {aiExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </div>
              <CardDescription>
                Ask questions about this template or request changes
              </CardDescription>
            </CardHeader>
            <CardContent className={`space-y-4 ${aiExpanded ? "flex-grow overflow-hidden flex flex-col" : ""}`}>
              <ScrollArea className={`rounded-md ${aiExpanded ? "flex-grow" : "h-[300px]"}`}>
                <div className="space-y-4 p-1">
                  {aiChatMessages.filter(msg => msg.role !== "system").map((message, index) => (
                    <div 
                      key={index} 
                      className={`${
                        message.role === "assistant" 
                          ? "bg-primary/10 p-3 rounded-lg rounded-tl-none max-w-[80%]" 
                          : "flex justify-end"
                      }`}
                    >
                      {message.role === "assistant" ? (
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                      ) : (
                        <div className="bg-primary text-primary-foreground p-3 rounded-lg rounded-tr-none max-w-[80%]">
                          <p className="text-sm">{message.content}</p>
                        </div>
                      )}
                    </div>
                  ))}
                  {isAiLoading && !aiChatMessages[aiChatMessages.length - 1]?.content && (
                    <div className="bg-primary/10 p-3 rounded-lg rounded-tl-none max-w-[80%]">
                      <div className="flex items-center space-x-2">
                        <div className="h-2 w-2 bg-primary/50 rounded-full animate-bounce"></div>
                        <div className="h-2 w-2 bg-primary/50 rounded-full animate-bounce delay-100"></div>
                        <div className="h-2 w-2 bg-primary/50 rounded-full animate-bounce delay-200"></div>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>
              
              <div className="flex space-x-2">
                <Input 
                  placeholder="Ask a question about this template..."
                  value={aiMessage}
                  onChange={(e) => setAiMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAiSend()}
                  disabled={isAiLoading}
                />
                <Button 
                  onClick={handleAiSend}
                  disabled={isAiLoading || !aiMessage.trim()}
                >
                  {isAiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
                </Button>
              </div>
              
              <p className="text-xs text-muted-foreground">
                {!azureOpenAISettings.enabled ? 
                  "Note: Azure OpenAI is not configured. Configure it in Settings for enhanced AI capabilities." :
                  "Ask questions about this template, request explanations, or suggest modifications."}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <History className="mr-2 h-5 w-5" />
                Version History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 pt-0">
              <div className="h-[200px] overflow-auto">
              {loadingVersions ? (
                <div className="text-center py-4">
                  <p>Loading versions...</p>
                </div>
              ) : versions.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">No version history available</p>
                </div>
              ) : (
                <div className="space-y-4" style={{ padding: "0px 20px 0px 0px"}}>
                  {versions.map((version) => (
                    <div key={version.id} className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium">Version {version.version}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(version.created_at).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {version.changes}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          By: {version.created_by}
                        </p>
                      </div>
                      {version.is_current ? (
                        <Badge>Current</Badge>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleRestoreVersion(version)}
                        >
                          Restore
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TemplateDetails;
